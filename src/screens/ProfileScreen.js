import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../theme/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import AppConfirmModal from '../components/AppConfirmModal';

const ProfileScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        (async () => {
            const data = await AsyncStorage.getItem('user');
            if (data) setUser(JSON.parse(data));
        })();
    }, []);

    const handleLogout = async () => {
        setModalConfig({
            visible: true,
            title: 'Logout',
            message: 'Are you sure you want to sign out?',
            confirmText: 'Logout',
            type: 'danger',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                // Clear Secure KeyStore/Keychain
                await Keychain.resetGenericPassword({ service: 'accessToken' });
                await Keychain.resetGenericPassword({ service: 'refreshToken' });
                // Clear non-sensitive storage
                await AsyncStorage.clear();
                navigation.replace('Login');
            }
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.avatar} />
                    <Text style={styles.name}>{user?.name}</Text>
                    <Text style={styles.email}>{user?.email}</Text>
                    <Text style={styles.workspaceName}>{user?.workspace}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{user?.role}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('ChangePassword')}
                >
                    <Text style={styles.actionBtnText}>Change Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={handleLogout}
                >
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {!user?.entity_id && (
                    <View style={styles.adminSection}>
                        <Text style={styles.adminTitle}>System Controls</Text>
                        <TouchableOpacity
                            style={styles.adminOption}
                            onPress={() => navigation.navigate('CompanyList')}
                        >
                            <Text style={styles.adminOptionText}>Manage Companies</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.adminOption}
                            onPress={() => navigation.navigate('ManageStatus')}
                        >
                            <Text style={styles.adminOptionText}>Manage Statuses</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {user?.entity_id && user?.role === 'ADMIN' && (
                    <View style={styles.adminSection}>
                        <Text style={styles.adminTitle}>Admin Controls</Text>
                        <TouchableOpacity style={styles.adminOption}>
                            <Text style={styles.adminOptionText}>Manage Users</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.adminOption}
                            onPress={() => navigation.navigate('ManageStatus')}
                        >
                            <Text style={styles.adminOptionText}>Manage Statuses</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

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
        paddingTop: 10,
        paddingHorizontal: 24,
        paddingBottom: 10,
        backgroundColor: Colors.white,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backBtn: {
        color: Colors.primary,
        fontWeight: '600',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
    },
    content: {
        padding: 24,
    },
    profileCard: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        marginBottom: 32,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.border,
        marginBottom: 16,
    },
    name: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.text,
    },
    email: {
        fontSize: 14,
        color: Colors.textLight,
        marginBottom: 4,
    },
    workspaceName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
        marginBottom: 12,
    },
    roleBadge: {
        backgroundColor: Colors.indigo + '15',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roleText: {
        color: Colors.indigo,
        fontWeight: '700',
        fontSize: 12,
    },
    logoutBtn: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.danger,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: Colors.danger,
        fontWeight: '700',
        fontSize: 16,
    },
    actionBtn: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    actionBtnText: {
        color: Colors.primary,
        fontWeight: '700',
        fontSize: 16,
    },
    adminSection: {
        marginTop: 40,
    },
    adminTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 12,
    },
    adminOption: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    adminOptionText: {
        color: Colors.text,
        fontWeight: '600',
    },
});

export default ProfileScreen;
