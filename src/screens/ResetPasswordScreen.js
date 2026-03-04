import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const ResetPasswordScreen = ({ route, navigation }) => {
    const { email } = route.params;
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const handleReset = async () => {
        if (!otp || !newPassword || !confirmPassword) {
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
                message: 'Passwords do not match',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/auth/forgot-password/reset', {
                email,
                otp,
                newPassword
            });
            setModalConfig({
                visible: true,
                title: 'Success',
                message: 'Your password has been reset successfully.',
                confirmText: 'Login Now',
                type: 'success',
                onConfirm: () => {
                    setModalConfig(prev => ({ ...prev, visible: false }));
                    navigation.navigate('Login');
                }
            });
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'Failed to reset password',
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
                <Text style={styles.title}>Reset Password</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.instruction}>
                    We've sent a 6-digit code to {email}. Enter it below along with your new password.
                </Text>

                <AppInput
                    label="Verification Code"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                />

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
                    title="Reset Password"
                    onPress={handleReset}
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
    instruction: {
        fontSize: normalize(14),
        color: Colors.textLight,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    submitBtn: { width: '100%', marginTop: 20 },
});

export default ResetPasswordScreen;
