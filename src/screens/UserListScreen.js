import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const UserListScreen = ({ navigation }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [showDeleted, setShowDeleted] = useState(false);
    const [parentTrace, setParentTrace] = useState([]); // Array of {id, name, role}
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const [userDataString, activeCompString] = await Promise.all([
                AsyncStorage.getItem('user'),
                AsyncStorage.getItem('activeCompanyId')
            ]);

            const parsedUser = userDataString ? JSON.parse(userDataString) : null;
            if (!parsedUser) return;

            // Normalize role to uppercase for consistent logic
            if (parsedUser.role) {
                parsedUser.role = parsedUser.role.toUpperCase();
            }
            setCurrentUser(parsedUser);

            const cleanActiveComp = (activeCompString === 'null' || !activeCompString) ? null : activeCompString;
            setActiveCompanyId(cleanActiveComp);

            let url = `/users?deleted=${showDeleted}`;

            if (!showDeleted) {
                if (parentTrace.length === 0) {
                    if (parsedUser.role === 'ADMIN') {
                        url += `&parent_id=${parsedUser.id}&role=L1`;
                    } else if (parsedUser.role === 'L1') {
                        url += `&parent_id=${parsedUser.id}&role=L2`;
                    } else {
                        // SUPERADMIN GLOBAL VIEW: Aggregating data from all companies
                        const currentEntity = selectedCompanyId || cleanActiveComp || parsedUser.entity_id;

                        if (!currentEntity) {
                            // Fetch all companies first
                            let companyList = companies;
                            if (companyList.length === 0) {
                                const compRes = await apiClient.get('/companies');
                                companyList = compRes.data || [];
                                setCompanies(companyList);
                            }

                            console.log(`Aggregating users from ${companyList.length} companies...`);

                            // Fetch root admins (those with ADMIN role but no entity_id)
                            const rootPromise = apiClient.get(`/users?deleted=${showDeleted}&role=ADMIN&_t=${Date.now()}`);

                            // Fetch all admins for each company
                            const companyPromises = companyList.map(c =>
                                apiClient.get(`/users?deleted=${showDeleted}&role=ADMIN&_t=${Date.now()}`, {
                                    headers: { 'X-Company-Context': c.id }
                                })
                                    .then(res => {
                                        const raw = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.data || []);
                                        // Manually attach entity_id to ensure navigation works
                                        const enriched = raw.map(u => ({
                                            ...u,
                                            entity_id: u.entity_id || c.id
                                        }));
                                        console.log(`- Company ${c.name}: Found ${enriched.length} admins`);
                                        return { ...res, data: enriched };
                                    })
                                    .catch(err => {
                                        console.log(`- Company ${c.name}: Fetch failed`, err.message);
                                        return { data: [] };
                                    })
                            );

                            const allResponses = await Promise.all([rootPromise, ...companyPromises]);
                            let aggregatedMap = new Map();
                            allResponses.forEach(res => {
                                const data = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.data || []);
                                data.forEach(u => {
                                    // TOP LEVEL: Only show ADMIN role users
                                    if (u.Role?.name === 'ADMIN') {
                                        aggregatedMap.set(u.id, u);
                                    }
                                });
                            });

                            const aggregated = Array.from(aggregatedMap.values());
                            console.log('Total Aggregated Admins Only:', aggregated.length);
                            setUsers(aggregated);
                            setLoading(false);
                            setRefreshing(false);
                            return; // Early exit
                        } else {
                            // Specific company selected: Only show ADMINs in that company
                            url += `&entity_id=${currentEntity}&role=ADMIN&parent_id=null`;
                        }
                    }
                } else {
                    const currentParent = parentTrace[parentTrace.length - 1];
                    // Sub-level: Find all children of this Admin (should be Staff)
                    url += `&parent_id=${currentParent.id}`;
                }
            }

            url += `&_t=${Date.now()}`;
            console.log('Fetching users from:', url);

            const currentParent = parentTrace[parentTrace.length - 1];
            const activeHeaderId = (selectedCompanyId && selectedCompanyId !== 'null') ? selectedCompanyId :
                (cleanActiveComp && cleanActiveComp !== 'null') ? cleanActiveComp :
                    currentParent?.entityId;

            const response = await apiClient.get(url, {
                headers: activeHeaderId ? { 'X-Company-Context': activeHeaderId } : {}
            });

            const rawData = response.data;
            let finalUsers = Array.isArray(rawData) ? rawData : (rawData.users || rawData.data || []);

            // Safety filter for top level
            if (parentTrace.length === 0 && !showDeleted) {
                const userRole = parsedUser?.role?.toUpperCase();
                if (userRole === 'ADMIN') {
                    finalUsers = finalUsers.filter(u => u.Role?.name?.toUpperCase() === 'L1');
                } else if (userRole === 'L1') {
                    finalUsers = finalUsers.filter(u => u.Role?.name?.toUpperCase() === 'L2');
                } else if (!parsedUser?.entity_id && !activeCompanyId) {
                    finalUsers = finalUsers.filter(u => u.Role?.name?.toUpperCase() === 'ADMIN');
                }
            }

            setUsers(finalUsers);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [showDeleted, parentTrace, selectedCompanyId]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchUsers();
        });
        return unsubscribe;
    }, [navigation, showDeleted, parentTrace, selectedCompanyId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchUsers();
    };

    const handleDrillDown = (user) => {
        const role = user.Role?.name;
        if (role === 'ADMIN' || role === 'L1') {
            setParentTrace([...parentTrace, { id: user.id, name: user.name, role: role, entityId: user.entity_id }]);
        } else if (role === 'L2') {
            // Drill down to Contacts (People)
            navigation.navigate('PeopleList', {
                parentStaff: {
                    id: user.id,
                    name: user.name,
                    entityId: user.entity_id
                }
            });
        }
    };

    const handleGoUp = () => {
        if (parentTrace.length > 0) {
            const newTrace = [...parentTrace];
            newTrace.pop();
            setParentTrace(newTrace);
        } else {
            navigation.goBack();
        }
    };

    const renderUserItem = ({ item }) => {
        const canDrill = (item.Role?.name === 'ADMIN' || item.Role?.name === 'L1' || item.Role?.name === 'L2') && !showDeleted;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => {
                    if (canDrill) {
                        handleDrillDown(item);
                    } else {
                        navigation.navigate('UserDetail', { userId: item.id, entityId: item.entity_id });
                    }
                }}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.avatar, { backgroundColor: Colors.indigo + '15' }]}>
                        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.userInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.userName}>{item.name}</Text>
                            {canDrill ? (
                                <Icon name="chevron-right" size={14} color={Colors.textLight} style={{ marginLeft: 4 }} />
                            ) : (
                                <Icon name="info" size={12} color={Colors.primary} style={{ marginLeft: 4 }} />
                            )}
                        </View>
                        <Text style={styles.userEmail}>{item.email}</Text>
                        {item.user_code && <Text style={styles.userCode}>Code: {item.user_code}</Text>}
                        {item.Parent && (
                            <Text style={styles.parentName}>Reports to: {item.Parent.name}</Text>
                        )}
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: item.Role?.name === 'ADMIN' || item.Role?.name === 'SUPERADMIN' ? '#FEE2E2' : '#DBEAFE' }]}>
                        <Text style={[styles.roleText, { color: item.Role?.name === 'ADMIN' || item.Role?.name === 'SUPERADMIN' ? '#B91C1C' : '#1E40AF' }]}>
                            {item.Role?.name || 'USER'}
                        </Text>
                    </View>
                    {!showDeleted ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('AddUser', { user: item })}
                                style={styles.editBtn}
                            >
                                <Icon name="edit-2" size={18} color={Colors.primary} />
                            </TouchableOpacity>

                            {currentUser?.id !== item.id && currentUser?.role?.toUpperCase() !== 'L1' && currentUser?.role?.toUpperCase() !== 'L2' && (
                                <TouchableOpacity
                                    onPress={() => handleDelete(item.id)}
                                    style={styles.deleteBtn}
                                >
                                    <Icon name="trash-2" size={18} color={Colors.danger} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => {
                                if (!currentUser?.entity_id) {
                                    navigation.navigate('RestoreUser', { userId: item.id });
                                } else {
                                    handleRestore(item.id);
                                }
                            }}
                            style={styles.restoreBtn}
                        >
                            <Icon name="rotate-ccw" size={18} color={Colors.success} />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity >
        );
    };

    const handleRestore = (id) => {
        setModalConfig({
            visible: true,
            title: 'Restore User',
            message: 'Are you sure you want to restore this user account?',
            confirmText: 'Restore',
            type: 'success',
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    await apiClient.post(`/users/${id}/restore`);
                    fetchUsers();
                } catch (error) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: error.response?.data?.message || 'Failed to restore user',
                        confirmText: 'OK',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                }
            },
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false }))
        });
    };

    const handleDelete = (id) => {
        setModalConfig({
            visible: true,
            title: 'Delete User',
            message: 'Are you sure? This will disable this user account and move it to the recycle bin.',
            confirmText: 'Delete',
            type: 'danger',
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    await apiClient.delete(`/users/${id}`);
                    fetchUsers();
                } catch (error) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: error.response?.data?.message || 'Failed to delete user',
                        confirmText: 'OK',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                }
            },
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false }))
        });
    };

    const getHeaderTitle = () => {
        if (showDeleted) return 'Recycle Bin';
        const userRole = currentUser?.role?.toUpperCase();
        if (parentTrace.length === 0) {
            if (userRole === 'ADMIN') return 'L1 Managers';
            if (userRole === 'L1') return 'L2 Supervisors';
            return (currentUser?.entity_id || activeCompanyId) ? 'Company Admins' : 'System Users';
        }
        const last = parentTrace[parentTrace.length - 1];
        const lastRole = last.role?.toUpperCase();
        if (lastRole === 'ADMIN') return `L1s of ${last.name}`;
        if (lastRole === 'L1') return `L2s of ${last.name}`;
        if (lastRole === 'L2') return `${last.name}'s Contacts`;
        return 'Team Members';
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleGoUp} style={styles.backBtn}>
                    <Icon name="chevron-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.title} numberOfLines={1}>{getHeaderTitle()}</Text>
                    {parentTrace.length > 0 && !showDeleted && (
                        <Text style={styles.breadcrumb}>
                            {parentTrace.map(p => p.name).join(' > ')}
                        </Text>
                    )}
                </View>
                <View style={styles.headerActions}>
                    {parentTrace.length === 0 && currentUser?.role !== 'L1' && currentUser?.role !== 'L2' && !showDeleted && (
                        <TouchableOpacity
                            onPress={() => setShowFilters(!showFilters)}
                            style={[styles.actionIcon, showFilters && styles.actionIconActive]}
                        >
                            <Icon name="filter" size={22} color={showFilters ? Colors.primary : Colors.textLight} />
                        </TouchableOpacity>
                    )}
                    {parentTrace.length === 0 && currentUser?.role !== 'L1' && currentUser?.role !== 'L2' && (
                        <TouchableOpacity
                            onPress={() => setShowDeleted(!showDeleted)}
                            style={[styles.trashBtn, showDeleted && styles.trashBtnActive]}
                        >
                            <Icon name={showDeleted ? "users" : "trash"} size={22} color={showDeleted ? Colors.primary : Colors.textLight} />
                        </TouchableOpacity>
                    )}
                    {!showDeleted && (!currentUser?.entity_id ? !!activeCompanyId : true) && (
                        <TouchableOpacity onPress={() => navigation.navigate('AddUser')} style={styles.addBtn}>
                            <Icon name="plus-circle" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {!showDeleted && showFilters && parentTrace.length === 0 && !currentUser?.entity_id && !activeCompanyId && companies.length > 0 && (
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        <TouchableOpacity
                            style={[styles.filterChip, !selectedCompanyId && styles.filterChipActive]}
                            onPress={() => setSelectedCompanyId(null)}
                        >
                            <Text style={[styles.filterText, !selectedCompanyId && styles.filterTextActive]}>All Admins</Text>
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
                    data={users}
                    renderItem={renderUserItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="users" size={48} color={Colors.border} />
                            <Text style={styles.emptyText}>No members found at this level</Text>
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
    backBtn: { padding: 4 },
    title: { fontSize: normalize(18), fontWeight: '700', color: Colors.text },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20 },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: { fontSize: 18, fontWeight: '700', color: Colors.indigo },
    userInfo: { flex: 1 },
    userName: { fontSize: normalize(15), fontWeight: '700', color: Colors.text },
    userEmail: { fontSize: normalize(12), color: Colors.textLight },
    userCode: { fontSize: normalize(11), color: Colors.primary, fontWeight: '600', marginTop: 2 },
    parentName: { fontSize: normalize(10), color: Colors.textLight, fontStyle: 'italic', marginTop: 2 },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    editBtn: { marginLeft: 12, padding: 4 },
    deleteBtn: { marginLeft: 12, padding: 4 },
    restoreBtn: { marginLeft: 12, padding: 4 },
    trashBtn: { padding: 4 },
    trashBtnActive: { backgroundColor: Colors.primary + '15', borderRadius: 8 },
    actionIcon: { marginRight: 15, padding: 4 },
    actionIconActive: { backgroundColor: Colors.primary + '15', borderRadius: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    roleText: {
        fontSize: 10,
        fontWeight: '700',
    },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: Colors.textLight, fontSize: normalize(14) },
    breadcrumb: { fontSize: normalize(10), color: Colors.primary, fontWeight: '600' },
});

export default UserListScreen;
