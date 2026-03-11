import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AppConfirmModal from '../components/AppConfirmModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';

const PersonDetailScreen = ({ route, navigation }) => {
    const { personId, entityId } = route.params;
    const [person, setPerson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchDetail = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('user');
            if (userDataString) {
                setCurrentUser(JSON.parse(userDataString));
            }

            console.log(`Fetching detail for ${personId} with entity ${entityId}`);
            let url = `/people/${personId}?_t=${Date.now()}`;
            // If superadmin, they might want to see deleted contact (e.g. for restore)
            if (!userDataString || !JSON.parse(userDataString).entity_id) {
                url += `&show_deleted=true`;
            }

            const response = await apiClient.get(url, {
                headers: entityId ? { 'X-Company-Context': entityId } : {}
            });
            setPerson(response.data);
        } catch (error) {
            console.error('Fetch detail error:', error);
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Could not fetch contact details',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchDetail();
        });
        return unsubscribe;
    }, [navigation, personId]);

    const handleCall = () => {
        if (person?.mobile) {
            Linking.openURL(`tel:${person.mobile}`);
        } else {
            setModalConfig({
                visible: true,
                title: 'Notice',
                message: 'No mobile number available for this contact',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        }
    };

    const handleWhatsApp = () => {
        if (person?.mobile) {
            const cleanNum = person.mobile.replace(/\D/g, '');
            Linking.openURL(`whatsapp://send?phone=${cleanNum}`);
        } else {
            setModalConfig({
                visible: true,
                title: 'Notice',
                message: 'No mobile number available for this contact',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        }
    };

    const handleDelete = async () => {
        setModalConfig({
            visible: true,
            title: 'Delete Contact',
            message: 'Are you sure you want to delete this contact? It will be moved to archives.',
            confirmText: 'Delete',
            type: 'danger',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    await apiClient.delete(`/people/${personId}`, {
                        headers: entityId ? { 'X-Company-Context': entityId } : {}
                    });
                    navigation.goBack();
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'Failed to delete');
                    setLoading(false);
                }
            }
        });
    };

    const handleRestore = async () => {
        setModalConfig({
            visible: true,
            title: 'Restore Contact',
            message: 'Bring this contact back to active list?',
            confirmText: 'Restore',
            type: 'success',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    await apiClient.post(`/people/${personId}/restore`, {}, {
                        headers: entityId ? { 'X-Company-Context': entityId } : {}
                    });
                    fetchDetail(); // Refresh
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'Failed to restore');
                    setLoading(false);
                }
            }
        });
    };

    const renderTags = () => {
        let tags = person?.tags;
        if (typeof tags === 'string') {
            try {
                // Attempt to parse if it's a stringified array like "['tag1', 'tag2']" or "[]"
                const parsed = JSON.parse(tags.replace(/'/g, '"'));
                if (Array.isArray(parsed)) tags = parsed;
            } catch (e) {
                // Not a JSON string, keep as is
            }
        }

        if (Array.isArray(tags)) {
            const cleanTags = tags.filter(t => t && t !== '[]' && t !== '""');
            return cleanTags.length > 0 ? cleanTags.join(', ') : 'None';
        }
        return (tags && tags !== '[]') ? tags : 'None';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
    };

    if (loading) return <ActivityIndicator style={styles.loader} color={Colors.primary} />;

    const isSuperAdmin = !currentUser?.entity_id;
    const isAdmin = currentUser?.role === 'ADMIN';
    const isL1 = currentUser?.role === 'L1';
    const isL2 = currentUser?.role === 'L2';
    const isOwner = person?.assigned_to === currentUser?.id;

    let canEdit = false;
    if (isSuperAdmin || isAdmin || isL1) {
        canEdit = true;
    } else if (isL2) {
        canEdit = isOwner;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                    <Icon name="chevron-left" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contact Detail</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileHeader}>
                    <View style={styles.avatarLarge} />
                    <Text style={styles.name}>{person?.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: person?.Status?.color + '20' }]}>
                        <Text style={[styles.statusText, { color: person?.Status?.color }]}>
                            {person?.Status?.name}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E0F2FE' }]} onPress={handleCall}>
                        <Icon name="phone" size={18} color="#0369A1" style={{ marginBottom: 4 }} />
                        <Text style={styles.actionBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]} onPress={handleWhatsApp}>
                        <Icon name="message-circle" size={18} color="#15803D" style={{ marginBottom: 4 }} />
                        <Text style={styles.actionBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                </View>

                {person?.is_deleted && (
                    <View style={styles.deleteWarning}>
                        <Icon name="alert-triangle" size={18} color={Colors.danger} />
                        <Text style={styles.deleteWarningText}>This contact is deleted</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Information</Text>
                    <View style={styles.infoCard}>
                        <InfoItem label="ID" value={person?.text_id || person?.textId} />
                        <InfoItem label="Mobile" value={person?.mobile || 'N/A'} />
                        <InfoItem label="Tags" value={renderTags()} />
                        <InfoItem label="Referred By" value={person?.referred_by || 'N/A'} />
                        <InfoItem label="Assigned To" value={person?.Assignee?.name || 'Unassigned'} />
                        <InfoItem label="Created At" value={formatDate(person?.created_at || person?.createdAt)} />
                        {person?.Creator?.name && <InfoItem label="Created By" value={person.Creator.name} />}
                        {person?.updated_at && <InfoItem label="Updated At" value={formatDate(person.updated_at || person.updatedAt)} />}
                        {person?.Updater?.name && <InfoItem label="Updated By" value={person.Updater.name} />}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Timeline</Text>
                    {person?.Timelines?.length > 0 ? (
                        person.Timelines.map((item, index) => (
                            <View key={item.id} style={styles.timelineItem}>
                                <View style={styles.timelineLine}>
                                    <View style={styles.timelineDot} />
                                    {index !== person.Timelines.length - 1 && <View style={styles.line} />}
                                </View>
                                <View style={styles.timelineContent}>
                                    <Text style={styles.timelineAction}>{item.action}</Text>
                                    <Text style={styles.timelineMeta}>
                                        {formatDate(item.timestamp)} • By {item.User?.name || 'System'}
                                    </Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No timeline events recorded</Text>
                    )}
                </View>
            </ScrollView>

            {(!person?.is_deleted && canEdit) && (
                <View style={styles.bottomContainer}>
                    <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                            style={[styles.fixedEditBtn, { flex: 2, marginRight: 10 }]}
                            onPress={() => navigation.navigate('AddUpdatePerson', { person })}
                        >
                            <Icon name="edit-3" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                            <Text style={styles.fixedEditBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.fixedEditBtn, { flex: 1, backgroundColor: Colors.border }]}
                            onPress={handleDelete}
                        >
                            <Icon name="trash-2" size={20} color={Colors.textLight} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {(person?.is_deleted && isSuperAdmin) && (
                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={[styles.fixedEditBtn, { backgroundColor: Colors.primary }]}
                        onPress={handleRestore}
                    >
                        <Icon name="refresh-cw" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.fixedEditBtnText}>Restore Contact</Text>
                    </TouchableOpacity>
                </View>
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

const InfoItem = ({ label, value }) => (
    <View style={styles.infoItem}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

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
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
    },
    editBtn: {
        color: Colors.primary,
        fontWeight: '700',
        fontSize: 16,
    },
    content: {
        padding: 24,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.border,
        marginBottom: 16,
    },
    name: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 8,
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    statusText: {
        fontWeight: '700',
        fontSize: 14,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 32,
    },
    actionBtn: {
        width: '45%',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    actionBtnText: {
        fontWeight: '700',
        color: Colors.text,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 16,
    },
    infoCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        elevation: 2,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.background,
    },
    infoLabel: {
        color: Colors.textLight,
        fontWeight: '500',
    },
    infoValue: {
        color: Colors.text,
        fontWeight: '600',
    },
    timelineItem: {
        flexDirection: 'row',
        minHeight: 60,
    },
    timelineLine: {
        alignItems: 'center',
        width: 30,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
        zIndex: 1,
    },
    line: {
        width: 2,
        flex: 1,
        backgroundColor: Colors.border,
        marginTop: -2,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 20,
        paddingLeft: 8,
    },
    timelineAction: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    timelineMeta: {
        fontSize: 12,
        color: Colors.textLight,
        marginTop: 4,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
    },
    emptyText: {
        color: Colors.textLight,
        textAlign: 'center',
    },
    bottomContainer: {
        padding: 20,
        backgroundColor: Colors.white,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    fixedEditBtn: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        elevation: 4,
    },
    fixedEditBtnText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '700',
    },
    deleteWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.danger + '10',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
    },
    deleteWarningText: {
        color: Colors.danger,
        fontWeight: '700',
        marginLeft: 8,
    },
});

export default PersonDetailScreen;
