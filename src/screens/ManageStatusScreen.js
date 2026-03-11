import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Switch, ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const ManageStatusScreen = ({ navigation }) => {
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchStatuses = async () => {
        try {
            setLoading(true);
            let url = '/statuses?all=true';
            if (selectedCompanyId) {
                url += `&entity_id=${selectedCompanyId}`;
            }
            const response = await apiClient.get(url);
            setStatuses(response.data);
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to fetch statuses',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                const parsed = JSON.parse(userData);
                setCurrentUser(parsed);
                // If superadmin, fetch companies
                if (!parsed.entity_id) {
                    try {
                        const compRes = await apiClient.get('/companies');
                        setCompanies(compRes.data || []);
                    } catch (e) {
                        console.error('Fetch companies error:', e);
                    }
                }
            }
            fetchStatuses();
        };

        const unsubscribe = navigation.addListener('focus', () => {
            loadInitialData();
        });
        loadInitialData();
        return unsubscribe;
    }, [navigation, selectedCompanyId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchStatuses();
        setRefreshing(false);
    };

    const toggleStatus = async (status) => {
        try {
            await apiClient.put(`/statuses/${status.id}`, {
                ...status,
                active: !status.active
            });
            fetchStatuses();
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to update status',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        }
    };

    const handleDelete = (status) => {
        setModalConfig({
            visible: true,
            title: 'Delete Status',
            message: `Are you sure you want to delete "${status.name}"? This will affect contacts currently using this status and cannot be undone.`,
            confirmText: 'Delete',
            type: 'danger',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    await apiClient.delete(`/statuses/${status.id}`);
                    fetchStatuses();
                } catch (error) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: 'Failed to delete status',
                        confirmText: 'OK',
                        type: 'danger',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                }
            }
        });
    };

    const renderItem = ({ item }) => (
        <View style={styles.statusItem}>
            <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
            <View style={styles.statusInfo}>
                <Text style={styles.statusName}>{item.name}</Text>
                <Text style={styles.statusActive}>{item.active ? 'Active' : 'Inactive'}</Text>
            </View>
            <View style={styles.actions}>
                <Switch
                    value={item.active}
                    onValueChange={() => toggleStatus(item)}
                    trackColor={{ false: '#767577', true: Colors.success + '80' }}
                    thumbColor={item.active ? Colors.success : '#f4f3f4'}
                />
                <TouchableOpacity
                    onPress={() => navigation.navigate('AddEditStatus', { status: item })}
                    style={styles.iconBtn}
                >
                    <Icon name="edit-2" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.iconBtn}
                >
                    <Icon name="trash-2" size={18} color={Colors.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Manage Statuses</Text>
                <View style={styles.headerActions}>
                    {!currentUser?.entity_id && companies.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setShowFilters(!showFilters)}
                            style={[styles.actionIcon, showFilters && styles.actionIconActive]}
                        >
                            <Icon name="filter" size={22} color={showFilters ? Colors.primary : Colors.textLight} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => navigation.navigate('AddEditStatus')}>
                        <Icon name="plus" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {showFilters && !currentUser?.entity_id && companies.length > 0 && (
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        <TouchableOpacity
                            style={[styles.filterChip, !selectedCompanyId && styles.filterChipActive]}
                            onPress={() => setSelectedCompanyId(null)}
                        >
                            <Text style={[styles.filterText, !selectedCompanyId && styles.filterTextActive]}>System Global</Text>
                        </TouchableOpacity>
                        {companies.map(comp => (
                            <TouchableOpacity
                                key={comp.id}
                                style={[styles.filterChip, selectedCompanyId === comp.id && styles.filterChipActive]}
                                onPress={() => setSelectedCompanyId(comp.id)}
                            >
                                <Text style={[styles.filterText, selectedCompanyId === comp.id && styles.filterTextActive]} numberOfLines={1}>
                                    {comp.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={statuses}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Icon name="list" size={48} color={Colors.border} />
                            <Text style={styles.emptyText}>No statuses found for this selection.</Text>
                        </View>
                    }
                />
            )}

            <AppConfirmModal
                visible={modalConfig.visible}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmText={modalConfig.confirmText}
                type={modalConfig.type}
                onConfirm={modalConfig.onConfirm}
                onCancel={modalConfig.onCancel}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: Colors.white,
    },
    title: { fontSize: normalize(18), fontWeight: '700', color: Colors.text },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    actionIcon: { marginRight: 15, padding: 4 },
    actionIconActive: { backgroundColor: Colors.primary + '15', borderRadius: 8 },
    filterContainer: {
        backgroundColor: Colors.white,
        paddingBottom: 15,
        elevation: 2,
    },
    filterScroll: {
        paddingHorizontal: 15,
        alignItems: 'center',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.background,
        marginRight: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        minWidth: 80,
        alignItems: 'center',
    },
    filterChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textLight,
    },
    filterTextActive: {
        color: Colors.white,
    },
    list: { padding: 20 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statusItem: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    colorIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
    statusInfo: { flex: 1 },
    statusName: { fontSize: 16, fontWeight: '700', color: Colors.text },
    statusActive: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center' },
    iconBtn: { marginLeft: 16, padding: 4 },
    empty: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: Colors.textLight, fontSize: 14, textAlign: 'center', marginTop: 12 },
});

export default ManageStatusScreen;
