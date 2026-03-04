import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Switch } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const ManageStatusScreen = ({ navigation }) => {
    const [statuses, setStatuses] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchStatuses = async () => {
        try {
            const response = await apiClient.get('/statuses?all=true');
            setStatuses(response.data);
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to fetch statuses',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchStatuses();
        });
        return unsubscribe;
    }, [navigation]);

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
                <TouchableOpacity onPress={() => navigation.navigate('AddEditStatus')}>
                    <Icon name="plus" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={statuses}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No statuses found. Tap + to add one.</Text>
                    </View>
                }
            />

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
    list: { padding: 20 },
    statusItem: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
    },
    colorIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
    statusInfo: { flex: 1 },
    statusName: { fontSize: 16, fontWeight: '600', color: Colors.text },
    statusActive: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center' },
    iconBtn: { marginLeft: 16, padding: 4 },
    empty: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: Colors.textLight, fontSize: 14 },
});

export default ManageStatusScreen;
