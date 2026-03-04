import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const UserDetailScreen = ({ route, navigation }) => {
    const { userId, entityId } = route.params;
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchDetail = async () => {
        try {
            // Reusing get users with a specific ID filter or we might need a single user endpoint
            // Usually /users is used with filters. Let's see if there is a /users/:id
            const response = await apiClient.get(`/users?id=${userId}`, {
                headers: entityId ? { 'X-Company-Context': entityId } : {}
            });
            const data = Array.isArray(response.data) ? response.data[0] : response.data;
            setUser(data);
        } catch (error) {
            console.error('Fetch user detail error:', error);
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Could not fetch user details',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [userId]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
    };

    if (loading) return <ActivityIndicator style={styles.loader} color={Colors.primary} />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="chevron-left" size={24} color={Colors.text} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('AddUser', { user })}>
                    <Icon name="edit-2" size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileHeader}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.name}>{user?.name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: Colors.primary + '20' }]}>
                        <Text style={[styles.roleText, { color: Colors.primary }]}>
                            {user?.Role?.name}
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account Information</Text>
                    <View style={styles.infoCard}>
                        <InfoItem label="Email" value={user?.email} icon="mail" />
                        <InfoItem label="User Code" value={user?.user_code || 'N/A'} icon="hash" />
                        <InfoItem label="Status" value={user?.active ? 'Active' : 'Inactive'} icon="activity" />
                        {user?.Parent && <InfoItem label="Reports To" value={user.Parent.name} icon="user" />}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Audit Trail</Text>
                    <View style={styles.infoCard}>
                        <InfoItem label="Created At" value={formatDate(user?.created_at || user?.createdAt)} icon="calendar" />
                        {user?.Creator?.name && <InfoItem label="Created By" value={user.Creator.name} icon="user-plus" />}
                        <InfoItem label="Updated At" value={formatDate(user?.updated_at || user?.updatedAt)} icon="clock" />
                        {user?.Updater?.name && <InfoItem label="Updated By" value={user.Updater.name} icon="edit-3" />}
                    </View>
                </View>
            </ScrollView>

            <AppConfirmModal
                visible={modalConfig.visible}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmText={modalConfig.confirmText}
                onConfirm={modalConfig.onConfirm}
            />
        </View>
    );
};

const InfoItem = ({ label, value, icon }) => (
    <View style={styles.infoItem}>
        <View style={styles.labelRow}>
            <Icon name={icon} size={16} color={Colors.textLight} style={{ marginRight: 8 }} />
            <Text style={styles.infoLabel}>{label}</Text>
        </View>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: Colors.white,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    backText: { fontSize: 16, fontWeight: '600', marginLeft: 4, color: Colors.text },
    content: { padding: 20 },
    profileHeader: { alignItems: 'center', marginBottom: 30 },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatarText: { fontSize: 32, fontWeight: '800', color: Colors.primary },
    name: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 5 },
    roleBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roleText: { fontWeight: '700', fontSize: 12 },
    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
    infoCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.background,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center' },
    infoLabel: { color: Colors.textLight, fontSize: 13, fontWeight: '500' },
    infoValue: { color: Colors.text, fontSize: 14, fontWeight: '600' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default UserDetailScreen;
