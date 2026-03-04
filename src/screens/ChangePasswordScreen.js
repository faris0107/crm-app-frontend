import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const ChangePasswordScreen = ({ navigation }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const handleChange = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Please fill in all fields',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }
        if (newPassword !== confirmPassword) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'New passwords do not match',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/auth/change-password', {
                oldPassword,
                newPassword
            });
            setModalConfig({
                visible: true,
                title: 'Success',
                message: 'Your password has been changed successfully.',
                confirmText: 'OK',
                type: 'success',
                onConfirm: () => {
                    setModalConfig(prev => ({ ...prev, visible: false }));
                    navigation.goBack();
                }
            });
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'Failed to change password',
                confirmText: 'OK',
                type: 'danger',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="chevron-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Change Password</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.iconContainer}>
                    <Icon name="lock" size={40} color={Colors.primary} />
                </View>

                <AppInput
                    label="Current Password"
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry
                />

                <View style={styles.divider} />

                <AppInput
                    label="New Password"
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                />

                <AppInput
                    label="Confirm New Password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                />

                <AppButton
                    title="Update Password"
                    onPress={handleChange}
                    loading={loading}
                    style={styles.submitBtn}
                />
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
    content: { padding: 24 },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 12,
        opacity: 0.5,
    },
    submitBtn: { width: '100%', marginTop: 20 },
});

export default ChangePasswordScreen;
