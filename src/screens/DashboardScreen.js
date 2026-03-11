import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const DashboardScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ total: 0, assigned: 0, companies: 0, users: 0 });
    const [recentPeople, setRecentPeople] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCompany, setActiveCompany] = useState(null);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const loadData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('user');
            if (!userDataString) return;
            const userData = JSON.parse(userDataString);
            setUser(userData);

            const activeCompId = await AsyncStorage.getItem('activeCompanyId');
            const activeCompName = await AsyncStorage.getItem('activeCompanyName');

            if (activeCompId) {
                setActiveCompany({ id: activeCompId, name: activeCompName });
            } else {
                setActiveCompany(null);
            }

            const effectiveEntityId = activeCompId || userData.entity_id;

            if (!effectiveEntityId) {
                // Global Super Admin Stats
                const response = await apiClient.get('/companies/stats');
                setStats({
                    companies: response.data.companies,
                    users: response.data.users,
                    total: response.data.contacts
                });
            } else {
                // Particular Company Stats
                let peopleRes;
                let usersRes = { data: [] };

                if (userData.role === 'L2') {
                    // L2 don't have permission to see users list
                    peopleRes = await apiClient.get('/people');
                } else {
                    [peopleRes, usersRes] = await Promise.all([
                        apiClient.get('/people'),
                        apiClient.get('/users?inactive=all')
                    ]);
                }

                const allPeople = peopleRes.data?.people || (Array.isArray(peopleRes.data) ? peopleRes.data : []);
                const totalPeopleCount = peopleRes.data?.pagination?.total ?? allPeople.length;
                const allUsersList = usersRes.data || [];

                let filteredPeople = allPeople;
                let filteredTeam = [];

                if (userData.role === 'L2') {
                    // L2 Supervisors only see their OWN contacts
                    filteredPeople = allPeople.filter(p => p.assigned_to === userData.id);
                    filteredTeam = [];
                } else if (userData.role === 'L1') {
                    // L1 Managers see L2s under them
                    filteredTeam = allUsersList.filter(u => u.parent_id === userData.id);
                    const l2Ids = filteredTeam.map(u => u.id);
                    // L1 see contacts assigned to their L2s
                    filteredPeople = allPeople.filter(p => l2Ids.includes(p.assigned_to));
                } else if (userData.role === 'ADMIN') {
                    // Admin see L1s under them
                    const l1Users = allUsersList.filter(u => u.parent_id === userData.id);
                    filteredTeam = l1Users;

                    const l1Ids = l1Users.map(u => u.id);
                    const l2Users = allUsersList.filter(u => l1Ids.includes(u.parent_id));
                    const l2Ids = l2Users.map(u => u.id);

                    // Admin see contacts assigned to the L2s in their hierarchy
                    filteredPeople = allPeople.filter(p => l2Ids.includes(p.assigned_to));
                }

                setStats({
                    total: totalPeopleCount,
                    assigned: allPeople.filter(p => p.assigned_to === userData.id).length,
                    users: filteredTeam.length
                });

                // Top 5 recent contacts
                setRecentPeople(filteredPeople.slice(0, 5));
            }
        } catch (error) {
            console.error('Fetch error:', error);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadData();
        });
        return unsubscribe;
    }, [navigation]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const StatCard = ({ title, value, color, icon, onPress, fullWidth }) => (
        <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: color }, fullWidth && { width: '100%' }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.statHeader}>
                <Text style={styles.statTitle}>{title}</Text>
                {icon && <Icon name={icon} size={14} color={color} />}
            </View>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
        </TouchableOpacity>
    );

    const isSuperAdmin = !user?.entity_id;

    const handleExitCompanyView = async () => {
        await AsyncStorage.removeItem('activeCompanyId');
        await AsyncStorage.removeItem('activeCompanyName');
        loadData();
    };

    const displayWorkspace = activeCompany ? activeCompany.name : (user?.workspace || 'Global System');
    const isCompanyView = !!activeCompany || !!user?.entity_id;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.greeting} numberOfLines={1}>{displayWorkspace}</Text>
                    <Text style={styles.userName}>{user?.name || 'User'}</Text>
                    {activeCompany && (
                        <TouchableOpacity style={styles.exitContextBtn} onPress={handleExitCompanyView}>
                            <Icon name="log-out" size={10} color={Colors.danger} />
                            <Text style={styles.exitContextText}>Return to Global View</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => navigation.navigate('Profile')}
                >
                    <View style={styles.avatarPlaceholder}>
                        <Icon name="user" size={24} color={Colors.textLight} />
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={styles.statsRow}>
                    {!isCompanyView ? (
                        <>
                            <StatCard
                                title="Companies"
                                value={stats.companies}
                                color={Colors.primary}
                                icon="briefcase"
                                onPress={() => navigation.navigate('CompanyList')}
                            />
                            <StatCard
                                title="System Users"
                                value={stats.users}
                                color={Colors.indigo}
                                icon="users"
                                onPress={() => navigation.navigate('UserList')}
                            />
                        </>
                    ) : (
                        <>
                            {(user?.role === 'SUPERADMIN' || user?.role === 'ADMIN' || user?.role === 'L1' || isSuperAdmin) ? (
                                <>
                                    <StatCard
                                        title="Total Team"
                                        value={stats.users || 0}
                                        color={Colors.indigo}
                                        icon="users"
                                        onPress={() => navigation.navigate('UserList')}
                                    />
                                    <StatCard
                                        title="Total Contacts"
                                        value={stats.total || 0}
                                        color={Colors.primary}
                                        icon="phone"
                                        onPress={() => navigation.navigate('PeopleList')}
                                    />
                                </>
                            ) : (
                                <>
                                    <StatCard
                                        title="Total Contacts"
                                        value={stats.total}
                                        color={Colors.primary}
                                        icon="phone"
                                        onPress={() => navigation.navigate('PeopleList')}
                                    />
                                    <StatCard
                                        title="Assigned to Me"
                                        value={stats.assigned}
                                        color={Colors.indigo}
                                        icon="user"
                                        onPress={() => navigation.navigate('PeopleList', { filter: 'assigned' })}
                                    />
                                </>
                            )}
                        </>
                    )}
                </View>

                {!isCompanyView && (
                    <View style={styles.statsRow}>
                        <StatCard
                            title="Global Contacts"
                            value={stats.total}
                            color={Colors.success}
                            icon="globe"
                            onPress={() => navigation.navigate('PeopleList')}
                        />
                        <View style={{ width: '48%' }} />
                    </View>
                )}

                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    {!isCompanyView ? (
                        <>
                            <TouchableOpacity
                                style={styles.actionCard}
                                onPress={() => navigation.navigate('CompanyList')}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                                    <Icon name="list" size={20} color={Colors.primary} />
                                </View>
                                <Text style={styles.actionText}>All Companies</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionCard}
                                onPress={() => navigation.navigate('AddCompany')}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
                                    <Icon name="plus-circle" size={20} color={Colors.success} />
                                </View>
                                <Text style={styles.actionText}>New Company</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionCard}
                                onPress={() => navigation.navigate('PeopleList')}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                                    <Icon name="users" size={20} color="#D97706" />
                                </View>
                                <Text style={styles.actionText}>All Contacts</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {(user?.role === 'SUPERADMIN' || user?.role === 'ADMIN' || user?.role === 'L1' || isSuperAdmin) ? (
                                <>
                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => navigation.navigate('PeopleList')}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                                            <Icon name="book-open" size={20} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.actionText}>All Contacts</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => navigation.navigate('AddUpdatePerson')}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
                                            <Icon name="plus" size={20} color={Colors.success} />
                                        </View>
                                        <Text style={styles.actionText}>New Contact</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => navigation.navigate('UserList')}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: '#E0E7FF' }]}>
                                            <Icon name="users" size={20} color={Colors.indigo} />
                                        </View>
                                        <Text style={styles.actionText}>Users</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => navigation.navigate('PeopleList')}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                                            <Icon name="book-open" size={20} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.actionText}>All Contacts</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => navigation.navigate('AddUpdatePerson')}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
                                            <Icon name="plus" size={20} color={Colors.success} />
                                        </View>
                                        <Text style={styles.actionText}>New Contact</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    )}
                </View>

                <Text style={styles.sectionTitle}>{!isCompanyView ? 'System Activity' : 'Recent Contacts'}</Text>
                <View style={styles.recentContainer}>
                    {recentPeople.length > 0 ? (
                        recentPeople.map(person => (
                            <TouchableOpacity
                                key={person.id}
                                style={styles.recentItem}
                                onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
                            >
                                <View style={styles.recentAvatar}>
                                    <Text style={styles.avatarTextShort}>{person.name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.recentName}>{person.name}</Text>
                                    <Text style={styles.recentMeta}>{person.text_id || person.textId}</Text>
                                </View>
                                <View style={[styles.miniBadge, { backgroundColor: person.Status?.color + '20' }]}>
                                    <Text style={[styles.miniBadgeText, { color: person.Status?.color }]}>{person.Status?.name}</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>Pull to refresh latest updates</Text>
                    )}
                </View>
            </ScrollView>

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
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: Colors.white,
    },
    greeting: {
        fontSize: normalize(14),
        color: Colors.textLight,
        fontWeight: '600',
    },
    userName: {
        fontSize: normalize(22),
        fontWeight: '800',
        color: Colors.text,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.border + '50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 24,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statCard: {
        backgroundColor: Colors.white,
        padding: 20,
        borderRadius: 16,
        width: '48%',
        borderLeftWidth: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textLight,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: normalize(24),
        fontWeight: '800',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: normalize(16),
        fontWeight: '700',
        color: Colors.text,
        marginTop: 16,
        marginBottom: 16,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 32,
    },
    actionCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        width: '30%',
        alignItems: 'center',
        elevation: 2,
    },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.text,
        textAlign: 'center',
    },
    recentContainer: {
        marginBottom: 20,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.white,
        borderRadius: 16,
        marginBottom: 12,
        elevation: 2,
    },
    recentAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarTextShort: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
    },
    recentName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text,
    },
    recentMeta: {
        fontSize: 12,
        color: Colors.textLight,
        marginTop: 2,
    },
    miniBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    miniBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    emptyText: {
        fontSize: 14,
        color: Colors.textLight,
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    },
    exitContextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    exitContextText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.danger,
        marginLeft: 4,
        textDecorationLine: 'underline',
    },
});

export default DashboardScreen;
