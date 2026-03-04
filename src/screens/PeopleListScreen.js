import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';

const PeopleListScreen = ({ route, navigation }) => {
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
    const [selectedFilters, setSelectedFilters] = useState({ companyId: null, adminId: null, l1Id: null, l2Id: null });
    const [showFilters, setShowFilters] = useState(false);

    const filterType = route?.params?.filter;
    const parentStaff = route?.params?.parentStaff;

    const fetchPeople = async () => {
        try {
            setLoading(true);
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

                let queryParams = [];
                const isGlobalSuper = !userData.entity_id && !cleanActiveComp;

                if (parentStaff) {
                    queryParams.push(`assigned_to=${parentStaff.id}`);
                } else if (userData?.role === 'L2') {
                    queryParams.push(`assigned_to=${userData.id}`);
                } else if (userData?.role === 'L1') {
                    const l2Res = await apiClient.get(`/users?parent_id=${userData.id}`);
                    const l2Ids = l2Res.data.map(u => u.id).join(',');
                    queryParams.push(`assigned_to=${l2Ids || '999999'}`);
                } else if (userData?.role === 'ADMIN') {
                    // Admin needs to find all L2s under their L1s
                    const l1Res = await apiClient.get(`/users?parent_id=${userData.id}`);
                    const l1Ids = l1Res.data.map(u => u.id);

                    const l2Promises = l1Ids.map(id => apiClient.get(`/users?parent_id=${id}`));
                    const l2Results = await Promise.all(l2Promises);
                    const l2Ids = l2Results.flatMap(res => res.data.map(u => u.id)).join(',');
                    queryParams.push(`assigned_to=${l2Ids || '999999'}`);
                } else if (isGlobalSuper) {
                    if (selectedFilters.l2Id) {
                        queryParams.push(`assigned_to=${selectedFilters.l2Id}`);
                    } else if (selectedFilters.l1Id) {
                        const l2Res = await apiClient.get(`/users?parent_id=${selectedFilters.l1Id}`);
                        const l2Ids = l2Res.data.map(u => u.id).join(',');
                        queryParams.push(`assigned_to=${l2Ids || '999999'}`);
                    } else if (selectedFilters.adminId) {
                        const l1Res = await apiClient.get(`/users?parent_id=${selectedFilters.adminId}`);
                        const l1Ids = l1Res.data.map(u => u.id);
                        const l2Promises = l1Ids.map(id => apiClient.get(`/users?parent_id=${id}`));
                        const l2Results = await Promise.all(l2Promises);
                        const l2Ids = l2Results.flatMap(res => res.data.map(u => u.id)).join(',');
                        queryParams.push(`assigned_to=${l2Ids || '999999'}`);
                    } else if (selectedFilters.companyId) {
                        // For SuperAdmins, using the header is safer than the query param for tenant partitioning
                        queryParams.push(`_t=${Date.now()}`);
                    } else {
                        // AGGREGATION MODE: Fetch from all companies
                        let companyList = companies;
                        if (companyList.length === 0) {
                            const cRes = await apiClient.get('/companies');
                            companyList = cRes.data || [];
                            setCompanies(companyList);
                        }

                        console.log(`Aggregating contacts from ${companyList.length} companies...`);

                        // Fetch root contacts
                        const rootPromise = apiClient.get(`/people?_t=${Date.now()}`);

                        // Fetch people for each company
                        const companyPromises = companyList.map(c =>
                            apiClient.get(`/people?_t=${Date.now()}`, {
                                headers: { 'X-Company-Context': c.id }
                            })
                                .then(res => {
                                    const raw = Array.isArray(res.data) ? res.data : (res.data?.people || res.data?.data || []);
                                    // Manually attach entity_id to ensure navigation works
                                    const enriched = raw.map(p => ({
                                        ...p,
                                        entity_id: p.entity_id || c.id
                                    }));
                                    console.log(`- Company ${c.name}: Found ${enriched.length} contacts`);
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
                            const data = Array.isArray(res.data) ? res.data : (res.data?.people || res.data?.data || []);
                            data.forEach(p => aggregatedMap.set(p.id, p));
                        });

                        const aggregated = Array.from(aggregatedMap.values());
                        console.log('Total Aggregated Contacts:', aggregated.length);
                        setPeople(aggregated);
                        setLoading(false);
                        setRefreshing(false);
                        return; // Early exit
                    }

                    if (companies.length === 0) {
                        const cRes = await apiClient.get('/companies');
                        setCompanies(cRes.data || []);
                    }
                } else if (cleanActiveComp) {
                    queryParams.push(`entity_id=${cleanActiveComp}`);
                }

                // Ensure _t is always present for cache busting
                if (!queryParams.some(p => p.startsWith('_t='))) {
                    queryParams.push(`_t=${Date.now()}`);
                }

                let url = '/people' + (queryParams.length > 0 ? '?' + queryParams.join('&') : '');
                console.log('Fetching people from:', url);

                const headers = (selectedFilters.companyId || parentStaff?.entityId) ?
                    { 'X-Company-Context': selectedFilters.companyId || parentStaff?.entityId } : {};

                console.log('Fetching people with Headers:', JSON.stringify(headers));

                const response = await apiClient.get(url, { headers });
                console.log('Full People Response JSON:', JSON.stringify(response.data).substring(0, 500));

                const rawData = response.data || [];
                let finalData = Array.isArray(rawData) ? rawData : (rawData.people || rawData.data || []);

                // Filter manually for safety/drill-down
                if (parentStaff) {
                    finalData = finalData.filter(p => p.assigned_to === parentStaff.id || p.assigned_to?.id === parentStaff.id);
                } else if (userData?.role === 'L2') {
                    finalData = finalData.filter(p => p.assigned_to === userData.id || p.assigned_to?.id === userData.id);
                }

                setPeople(finalData);
            }
        } catch (error) {
            console.error('Fetch People Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPeople();
    }, [parentStaff, selectedFilters]);

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

    const onRefresh = () => {
        setRefreshing(true);
        fetchPeople();
    };

    const filteredPeople = people.filter(p => {
        const pId = p.text_id || p.textId || '';
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            pId.toLowerCase().includes(search.toLowerCase());

        if (filterType === 'assigned' && userId) {
            return matchesSearch && p.assigned_to === userId;
        }
        return matchesSearch;
    });

    const renderItem = ({ item }) => (
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
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.Status?.color + '20' || Colors.border }]}>
                    <Text style={[styles.statusText, { color: item.Status?.color || Colors.textLight }]}>
                        {item.Status?.name || 'No Status'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

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
                    {!parentStaff && !currentUser?.entity_id && !activeCompanyId && (
                        <TouchableOpacity
                            onPress={() => setShowFilters(!showFilters)}
                            style={{ marginRight: 15 }}
                        >
                            <Icon name="filter" size={24} color={showFilters ? Colors.primary : Colors.textLight} />
                        </TouchableOpacity>
                    )}
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
                    placeholder="Search by name or ID..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={Colors.textLight}
                />
            </View>

            {!parentStaff && !currentUser?.entity_id && !activeCompanyId && showFilters && (
                <View style={styles.globalFilters}>
                    {/* Level 1: Company */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                        <TouchableOpacity
                            style={[styles.filterChip, !selectedFilters.companyId && styles.filterChipActive]}
                            onPress={() => setSelectedFilters({ companyId: null, adminId: null, l1Id: null, l2Id: null })}
                        >
                            <Text style={[styles.filterChipText, !selectedFilters.companyId && styles.filterChipTextActive]}>All Companies</Text>
                        </TouchableOpacity>
                        {companies.map(c => (
                            <TouchableOpacity
                                key={c.id}
                                style={[styles.filterChip, selectedFilters.companyId === c.id && styles.filterChipActive]}
                                onPress={() => setSelectedFilters({ companyId: c.id, adminId: null, l1Id: null, l2Id: null })}
                            >
                                <Text style={[styles.filterChipText, selectedFilters.companyId === c.id && styles.filterChipTextActive]}>{c.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

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

            {loading ? (
                <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : (
                <FlatList
                    data={filteredPeople}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No contacts found</Text>
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
