import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';

const PeopleListScreen = ({ route, navigation }) => {
    const filterType = route?.params?.filter;
    const parentStaff = route?.params?.parentStaff;

    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [userId, setUserId] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [l1Managers, setL1Managers] = useState([]);
    const [l2Supervisors, setL2Supervisors] = useState([]);
    const [selectedFilters, setSelectedFilters] = useState({
        companyId: null,
        adminId: null,
        l1Id: null,
        l2Id: null,
        statusId: null,
        assignment: filterType === 'assigned' ? 'me' : 'all',
        showDeleted: false
    });
    const [showFilters, setShowFilters] = useState(false);
    const [statuses, setStatuses] = useState([]);

    // Pagination states
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchPeople = async (pageNumber = 1, isRefreshing = false) => {
        if (pageNumber > 1) setLoadingMore(true);
        else if (!isRefreshing) setLoading(true);

        try {
            const [userDataString, activeCompString] = await Promise.all([
                AsyncStorage.getItem('user'),
                AsyncStorage.getItem('activeCompanyId')
            ]);

            if (userDataString) {
                const userData = JSON.parse(userDataString);
                setUserId(userData.id);
                setCurrentUser(userData);

                const cleanActiveComp = (activeCompString === 'null' || !activeCompString) ? null : activeCompString;
                setActiveCompanyId(cleanActiveComp);

                let queryParams = [`page=${pageNumber}`, `limit=48`];
                if (debouncedSearch) {
                    queryParams.push(`search=${encodeURIComponent(debouncedSearch)}`);
                }

                if (selectedFilters.statusId) {
                    queryParams.push(`status_id=${selectedFilters.statusId}`);
                }

                if (selectedFilters.showDeleted) {
                    queryParams.push('show_deleted=true');
                }

                const isGlobalSuper = !userData.entity_id && !cleanActiveComp;

                if (parentStaff) {
                    queryParams.push(`assigned_to=${parentStaff.id}`);
                } else if (selectedFilters.assignment === 'me' && userData.id) {
                    queryParams.push(`assigned_to=${userData.id}`);
                } else if (selectedFilters.assignment === 'unassigned') {
                    queryParams.push(`assigned_to=null`);
                } else if (isGlobalSuper) {
                    if (selectedFilters.l2Id) {
                        queryParams.push(`assigned_to=${selectedFilters.l2Id}`);
                    } else if (selectedFilters.l1Id) {
                        queryParams.push(`parent_l1=${selectedFilters.l1Id}`);
                    } else if (selectedFilters.adminId) {
                        queryParams.push(`parent_admin=${selectedFilters.adminId}`);
                    }
                }

                let url = '/people' + (queryParams.length > 0 ? '?' + queryParams.join('&') : '');
                const headers = (selectedFilters.companyId || parentStaff?.entityId) ?
                    { 'X-Company-Context': selectedFilters.companyId || parentStaff?.entityId } : {};

                const response = await apiClient.get(url, { headers });

                // Handle new backend response format
                const rawData = response.data.people || [];
                const pagination = response.data.pagination || { hasMore: false };

                if (pageNumber === 1) {
                    setPeople(rawData);
                } else {
                    setPeople(prev => [...prev, ...rawData]);
                }

                setHasMore(pagination.hasMore);
                setPage(pageNumber);
            }
        } catch (error) {
            console.error('Fetch People Error:', error);
            setHasMore(false); // Stop loading more on error to prevent loops
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            // Re-fetch the first page to ensure list accuracy after returning from details/edit
            fetchPeople(1);
        });
        return unsubscribe;
    }, [navigation, selectedFilters, debouncedSearch]);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        fetchPeople(1);
    }, [parentStaff, selectedFilters, debouncedSearch, filterType]);

    useEffect(() => {
        if (selectedFilters.companyId) {
            apiClient.get(`/users?entity_id=${selectedFilters.companyId}&role=ADMIN&parent_id=null`)
                .then(res => setAdmins(res.data));
        } else {
            setAdmins([]);
            setL1Managers([]);
            setL2Supervisors([]);
        }
    }, [selectedFilters.companyId]);

    useEffect(() => {
        if (selectedFilters.adminId) {
            apiClient.get(`/users?parent_id=${selectedFilters.adminId}`)
                .then(res => setL1Managers(res.data));
        } else {
            setL1Managers([]);
            setL2Supervisors([]);
        }
    }, [selectedFilters.adminId]);

    useEffect(() => {
        if (selectedFilters.l1Id) {
            apiClient.get(`/users?parent_id=${selectedFilters.l1Id}`)
                .then(res => setL2Supervisors(res.data));
        } else {
            setL2Supervisors([]);
        }
    }, [selectedFilters.l1Id]);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [sRes, userStr] = await Promise.all([
                    apiClient.get('/statuses'),
                    AsyncStorage.getItem('user')
                ]);
                setStatuses(sRes.data);

                if (userStr) {
                    const user = JSON.parse(userStr);
                    // Only sub-admins/super-admins should fetch companies
                    if (!user.entity_id) {
                        const cRes = await apiClient.get('/companies');
                        setCompanies(cRes.data);
                    }
                }
            } catch (error) {
                console.log('Metadata fetch partial fail (expected for some roles):', error.message);
            }
        };
        fetchMetadata();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
        fetchPeople(1, true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            fetchPeople(page + 1);
        }
    };

    // Backend already handles search, frontend filtering is unused here
    // as the FlatList uses the 'people' state directly.

    const renderItem = ({ item }) => {
        const isAssigned = !!item.assigned_to;
        const assigneeName = item.Assignee?.name || 'Unassigned';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('PersonDetail', {
                    personId: item.id,
                    entityId: item.entity_id
                })}
            >
                <View style={styles.cardContent}>
                    <View style={styles.infoContainer}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.textId}>ID: {item.text_id || item.textId}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Icon name="user" size={12} color={isAssigned ? Colors.primary : Colors.danger} />
                            <Text style={[styles.assigneeText, { color: isAssigned ? Colors.primary : Colors.danger }]}>
                                {assigneeName}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.badgeContainer}>
                        <View style={[styles.statusBadge, { backgroundColor: (item.Status?.color || Colors.border) + '20' }]}>
                            <Text style={[styles.statusText, { color: item.Status?.color || Colors.textLight }]}>
                                {item.Status?.name || 'No Status'}
                            </Text>
                        </View>
                        {!isAssigned && (
                            <View style={[styles.unassignedBadge]}>
                                <Text style={styles.unassignedText}>OPEN</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const getHeaderTitle = () => {
        if (parentStaff) return `${parentStaff.name}'s Contacts`;
        return (!currentUser?.entity_id && !activeCompanyId) ? 'Global Contacts' : 'Company Contacts';
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {parentStaff && (
                        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 10, padding: 5 }}>
                            <Icon name="chevron-left" size={24} color={Colors.text} />
                        </TouchableOpacity>
                    )}
                    <Text style={[styles.title, parentStaff && { fontSize: 20 }]}>{getHeaderTitle()}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => setShowFilters(!showFilters)}
                        style={{ marginRight: 15 }}
                    >
                        <Icon name="filter" size={24} color={showFilters ? Colors.primary : Colors.textLight} />
                    </TouchableOpacity>
                    {(!currentUser?.entity_id ? !!activeCompanyId : true) && (
                        <TouchableOpacity onPress={() => navigation.navigate('AddUpdatePerson', { parentStaff })}>
                            <Text style={styles.addButton}>Add New</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search name, ID or mobile..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={Colors.textLight}
                />
            </View>

            {showFilters && (
                <View style={styles.globalFilters}>
                    {/* Level 0: Assignment Filter (Always Visible) */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                        {!selectedFilters.showDeleted && (
                            <>
                                <TouchableOpacity
                                    style={[styles.filterChip, selectedFilters.assignment === 'all' && styles.filterChipActive]}
                                    onPress={() => setSelectedFilters(prev => ({ ...prev, assignment: 'all' }))}
                                >
                                    <Text style={[styles.filterChipText, selectedFilters.assignment === 'all' && styles.filterChipTextActive]}>All Contacts</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.filterChip, selectedFilters.assignment === 'me' && styles.filterChipActive]}
                                    onPress={() => setSelectedFilters(prev => ({ ...prev, assignment: 'me' }))}
                                >
                                    <Text style={[styles.filterChipText, selectedFilters.assignment === 'me' && styles.filterChipTextActive]}>Assigned to Me</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.filterChip, selectedFilters.assignment === 'unassigned' && styles.filterChipActive]}
                                    onPress={() => setSelectedFilters(prev => ({ ...prev, assignment: 'unassigned' }))}
                                >
                                    <Text style={[styles.filterChipText, selectedFilters.assignment === 'unassigned' && styles.filterChipTextActive]}>Unassigned</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Special Filter for Super Admin: Show Deleted */}
                        {!currentUser?.entity_id && !activeCompanyId && (
                            <TouchableOpacity
                                style={[styles.filterChip, selectedFilters.showDeleted && { backgroundColor: Colors.danger, borderColor: Colors.danger }]}
                                onPress={() => setSelectedFilters(prev => ({ ...prev, showDeleted: !prev.showDeleted }))}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Icon name="trash-2" size={14} color={selectedFilters.showDeleted ? Colors.white : Colors.textLight} style={{ marginRight: 6 }} />
                                    <Text style={[styles.filterChipText, selectedFilters.showDeleted && { color: Colors.white }]}>
                                        {selectedFilters.showDeleted ? 'Viewing Archive' : 'View Deleted'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Level 0.5: Status Filter (Always Visible) */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                        <TouchableOpacity
                            style={[styles.filterChip, !selectedFilters.statusId && styles.filterChipActive]}
                            onPress={() => setSelectedFilters(prev => ({ ...prev, statusId: null }))}
                        >
                            <Text style={[styles.filterChipText, !selectedFilters.statusId && styles.filterChipTextActive]}>All Status</Text>
                        </TouchableOpacity>
                        {statuses.map(s => (
                            <TouchableOpacity
                                key={s.id}
                                style={[styles.filterChip, selectedFilters.statusId === s.id && styles.filterChipActive]}
                                onPress={() => setSelectedFilters(prev => ({ ...prev, statusId: s.id }))}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.statusDot, { backgroundColor: s.color, width: 8, height: 8, borderRadius: 4, marginRight: 6 }]} />
                                    <Text style={[styles.filterChipText, selectedFilters.statusId === s.id && styles.filterChipTextActive]}>{s.name}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Hierarchy Filters (Only for Global Admins) */}
                    {!parentStaff && !currentUser?.entity_id && !activeCompanyId && (
                        <>
                            {/* Level 1: Company */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                                <TouchableOpacity
                                    style={[styles.filterChip, !selectedFilters.companyId && styles.filterChipActive]}
                                    onPress={() => setSelectedFilters(prev => ({ ...prev, companyId: null, adminId: null, l1Id: null, l2Id: null }))}
                                >
                                    <Text style={[styles.filterChipText, !selectedFilters.companyId && styles.filterChipTextActive]}>All Companies</Text>
                                </TouchableOpacity>
                                {companies.map(c => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.filterChip, selectedFilters.companyId === c.id && styles.filterChipActive]}
                                        onPress={() => setSelectedFilters(prev => ({ ...prev, companyId: c.id, adminId: null, l1Id: null, l2Id: null }))}
                                    >
                                        <Text style={[styles.filterChipText, selectedFilters.companyId === c.id && styles.filterChipTextActive]}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </>
                    )}

                    {/* Level 2: Admin */}
                    {selectedFilters.companyId && admins.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            <TouchableOpacity
                                style={[styles.filterChip, !selectedFilters.adminId && styles.filterChipActive]}
                                onPress={() => setSelectedFilters(prev => ({ ...prev, adminId: null, l1Id: null, l2Id: null }))}
                            >
                                <Text style={[styles.filterChipText, !selectedFilters.adminId && styles.filterChipTextActive]}>All Admins</Text>
                            </TouchableOpacity>
                            {admins.map(a => (
                                <TouchableOpacity
                                    key={a.id}
                                    style={[styles.filterChip, selectedFilters.adminId === a.id && styles.filterChipActive]}
                                    onPress={() => setSelectedFilters(prev => ({ ...prev, adminId: a.id, l1Id: null, l2Id: null }))}
                                >
                                    <Text style={[styles.filterChipText, selectedFilters.adminId === a.id && styles.filterChipTextActive]}>{a.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Level 3: L1 Managers */}
                    {selectedFilters.adminId && l1Managers.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            <TouchableOpacity
                                style={[styles.filterChip, !selectedFilters.l1Id && styles.filterChipActive]}
                                onPress={() => setSelectedFilters(prev => ({ ...prev, l1Id: null, l2Id: null }))}
                            >
                                <Text style={[styles.filterChipText, !selectedFilters.l1Id && styles.filterChipTextActive]}>All L1</Text>
                            </TouchableOpacity>
                            {l1Managers.map(l1 => (
                                <TouchableOpacity
                                    key={l1.id}
                                    style={[styles.filterChip, selectedFilters.l1Id === l1.id && styles.filterChipActive]}
                                    onPress={() => setSelectedFilters(prev => ({ ...prev, l1Id: l1.id, l2Id: null }))}
                                >
                                    <Text style={[styles.filterChipText, selectedFilters.l1Id === l1.id && styles.filterChipTextActive]}>{l1.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Level 4: L2 Supervisors */}
                    {selectedFilters.l1Id && l2Supervisors.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            <TouchableOpacity
                                style={[styles.filterChip, !selectedFilters.l2Id && styles.filterChipActive]}
                                onPress={() => setSelectedFilters(prev => ({ ...prev, l2Id: null }))}
                            >
                                <Text style={[styles.filterChipText, !selectedFilters.l2Id && styles.filterChipTextActive]}>All L2</Text>
                            </TouchableOpacity>
                            {l2Supervisors.map(l2 => (
                                <TouchableOpacity
                                    key={l2.id}
                                    style={[styles.filterChip, selectedFilters.l2Id === l2.id && styles.filterChipActive]}
                                    onPress={() => setSelectedFilters(prev => ({ ...prev, l2Id: l2.id }))}
                                >
                                    <Text style={[styles.filterChipText, selectedFilters.l2Id === l2.id && styles.filterChipTextActive]}>{l2.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}

            {loading && page === 1 ? (
                <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : (
                <FlatList
                    data={people}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />
                        ) : null
                    }
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No contacts found'}</Text>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingTop: 10,
        paddingHorizontal: 24,
        paddingBottom: 10,
        backgroundColor: Colors.white,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.text,
    },
    addButton: {
        color: Colors.primary,
        fontWeight: '700',
        fontSize: 16,
    },
    searchContainer: {
        padding: 16,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    searchInput: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        fontSize: 16,
        color: Colors.text,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
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
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 4,
    },
    textId: {
        fontSize: 14,
        color: Colors.textLight,
        marginBottom: 2,
    },
    mobile: {
        fontSize: 14,
        color: Colors.textLight,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    assigneeText: {
        fontSize: 12,
        marginLeft: 4,
        fontWeight: '600',
    },
    badgeContainer: {
        alignItems: 'flex-end',
    },
    unassignedBadge: {
        backgroundColor: Colors.danger + '15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
        borderWidth: 1,
        borderColor: Colors.danger + '30',
    },
    unassignedText: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.danger,
    },
    globalFilters: {
        backgroundColor: Colors.white,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    filterRow: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.background,
        marginRight: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 4,
    },
    filterChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textLight,
    },
    filterChipTextActive: {
        color: Colors.white,
    },
    loader: {
        marginTop: 40,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: Colors.textLight,
    },
});

export default PeopleListScreen;
