import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const handleSendOTP = async () => {
        if (!email) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Please enter your email address',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/auth/forgot-password/request', { email });
            setModalConfig({
                visible: true,
                title: 'OTP Sent',
                message: 'A password reset code has been sent to your email.',
                confirmText: 'OK',
                type: 'success',
                onConfirm: () => {
                    setModalConfig(prev => ({ ...prev, visible: false }));
                    navigation.navigate('ResetPassword', { email });
                }
            });
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'Failed to send OTP',
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
                <Text style={styles.title}>Forgot Password</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Icon name="mail" size={48} color={Colors.primary} />
                </View>

                <Text style={styles.instruction}>
                    Enter your registered email address and we'll send you a code to reset your password.
                </Text>

                <AppInput
                    label="Email Address"
                    placeholder="name@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <AppButton
                    title="Send Reset Code"
                    onPress={handleSendOTP}
                    loading={loading}
                    style={styles.submitBtn}
                />
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
    content: { padding: 24, alignItems: 'center' },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 40,
    },
    instruction: {
        fontSize: normalize(14),
        color: Colors.textLight,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    submitBtn: { width: '100%', marginTop: 12 },
});

export default ForgotPasswordScreen;
