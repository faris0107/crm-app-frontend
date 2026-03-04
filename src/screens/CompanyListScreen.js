import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const CompanyListScreen = ({ navigation }) => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchCompanies = async () => {
        try {
            const response = await apiClient.get(`/companies?deleted=${showDeleted}`);
            setCompanies(response.data);
        } catch (error) {
            console.error('Failed to fetch companies:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, [showDeleted]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchCompanies();
        });
        return unsubscribe;
    }, [navigation, showDeleted]);

    const handleRestore = (id, name) => {
        setModalConfig({
            visible: true,
            title: 'Restore Company',
            message: `Do you want to restore ${name}? This will reactivate the company account.`,
            confirmText: 'Restore',
            type: 'success',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    await apiClient.post(`/companies/${id}/restore`);
                    fetchCompanies();
                } catch (error) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: 'Failed to restore company',
                        confirmText: 'OK',
                        type: 'danger',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                }
            }
        });
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCompanies();
    };

    const handleSwitch = async (id, name) => {
        setModalConfig({
            visible: true,
            title: 'Switch Context',
            message: `Are you sure you want to switch to ${name} view? You will only see data for this company.`,
            confirmText: 'Switch',
            type: 'default',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                await AsyncStorage.setItem('activeCompanyId', id.toString());
                await AsyncStorage.setItem('activeCompanyName', name);
                setModalConfig({
                    visible: true,
                    title: 'Switched!',
                    message: `You are now viewing ${name}.`,
                    confirmText: 'Go to Dashboard',
                    type: 'success',
                    onConfirm: () => {
                        setModalConfig(prev => ({ ...prev, visible: false }));
                        navigation.navigate('Dashboard');
                    }
                });
            }
        });
    };

    const handleDelete = (id, name) => {
        setModalConfig({
            visible: true,
            title: 'Delete Company',
            message: `Are you sure you want to delete ${name}? This action cannot be undone and will affect all users associated with it.`,
            confirmText: 'Delete',
            type: 'danger',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    await apiClient.delete(`/companies/${id}`);
                    fetchCompanies();
                } catch (error) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: 'Failed to delete company',
                        confirmText: 'OK',
                        type: 'danger',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                }
            }
        });
    };

    const renderCompanyItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.companyIcon}>
                    <Text style={styles.iconText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>{item.name}</Text>
                    <Text style={styles.companyCode}>{item.code}</Text>
                </View>
                <View style={styles.actionButtons}>
                    {!item.is_deleted ? (
                        <>
                            <TouchableOpacity
                                onPress={() => handleSwitch(item.id, item.name)}
                                style={styles.iconBtn}
                                title="Switch to this company"
                            >
                                <Icon name="external-link" size={18} color={Colors.success} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('EditCompany', { company: item })}
                                style={styles.iconBtn}
                            >
                                <Icon name="edit-2" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleDelete(item.id, item.name)}
                                style={styles.iconBtn}
                            >
                                <Icon name="trash-2" size={18} color={Colors.danger} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            onPress={() => handleRestore(item.id, item.name)}
                            style={styles.iconBtn}
                        >
                            <Icon name="rotate-ccw" size={18} color={Colors.success} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.adminInfo}>
                <Icon name="user" size={14} color={Colors.textLight} />
                <Text style={styles.adminText}>
                    {item.Users && item.Users.length > 0 ? item.Users[0].name : 'No Admin Assigned'}
                </Text>
            </View>

            <View style={[styles.statusRow, { marginTop: 4 }]}>
                <View style={[styles.statusBadge, { backgroundColor: item.active ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Text style={[styles.statusText, { color: item.active ? '#15803D' : '#991B1B' }]}>
                        {item.active ? 'Active' : 'Inactive'}
                    </Text>
                </View>
                <View style={styles.contactItem}>
                    <Icon name="mail" size={14} color={Colors.textLight} />
                    <Text style={styles.contactText}>{item.primary_email || 'N/A'}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="chevron-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Company Management</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => navigation.navigate('AddCompany')}
                >
                    <Icon name="plus" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, !showDeleted && styles.activeTab]}
                    onPress={() => setShowDeleted(false)}
                >
                    <Text style={[styles.tabText, !showDeleted && styles.activeTabText]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, showDeleted && styles.activeTab]}
                    onPress={() => setShowDeleted(true)}
                >
                    <Text style={[styles.tabText, showDeleted && styles.activeTabText]}>Deleted</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={companies}
                    renderItem={renderCompanyItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No companies registered yet</Text>
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
    backBtn: { padding: 4 },
    title: { fontSize: normalize(18), fontWeight: '700', color: Colors.text },
    addBtn: { padding: 4 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20 },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    companyIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconText: { fontSize: 20, fontWeight: '700', color: Colors.primary },
    companyInfo: { flex: 1 },
    companyName: { fontSize: normalize(15), fontWeight: '700', color: Colors.text },
    companyCode: { fontSize: normalize(11), color: Colors.textLight, fontWeight: '600' },
    actionButtons: { flexDirection: 'row' },
    iconBtn: { padding: 8, marginLeft: 4 },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
    adminInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    adminText: { fontSize: normalize(13), color: Colors.text, marginLeft: 8, fontWeight: '500' },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    contactItem: { flexDirection: 'row', alignItems: 'center' },
    contactText: { fontSize: normalize(12), color: Colors.textLight, marginLeft: 8 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: Colors.textLight, fontSize: normalize(14) },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    activeTab: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textLight,
    },
    activeTabText: {
        color: Colors.white,
    },
});

export default CompanyListScreen;
