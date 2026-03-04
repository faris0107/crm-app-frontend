import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import AppConfirmModal from '../components/AppConfirmModal';

const PersonDetailScreen = ({ route, navigation }) => {
    const { personId, entityId } = route.params;
    const [person, setPerson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchDetail = async () => {
        try {
            console.log(`Fetching detail for ${personId} with entity ${entityId}`);
            const response = await apiClient.get(`/people/${personId}?_t=${Date.now()}`, {
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('AddUpdatePerson', { person })}>
                    <Text style={styles.editBtn}>Edit</Text>
                </TouchableOpacity>
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
                        <Text style={styles.actionBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]} onPress={handleWhatsApp}>
                        <Text style={styles.actionBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                </View>

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
    },
    backBtn: {
        color: Colors.primary,
        fontWeight: '600',
    },
    editBtn: {
        color: Colors.accent,
        fontWeight: '600',
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
});

export default PersonDetailScreen;
