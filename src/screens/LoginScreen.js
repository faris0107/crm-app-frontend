import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AppConfirmModal from '../components/AppConfirmModal';

// Replace with your Web Client ID from Google Cloud Console
const GOOGLE_WEB_CLIENT_ID = '84393753692-ctb0mp8ft9l5vhcmk7s2p133cft52q3o.apps.googleusercontent.com';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    React.useEffect(() => {
        GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true,
        });
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            setModalConfig({
                visible: true,
                title: 'Required',
                message: 'Please enter your email and password.',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }
        setLoading(true);
        try {
            const response = await apiClient.post('/auth/login', {
                email,
                password,
            });
            const { accessToken, refreshToken, user: userData } = response.data;

            // Store tokens in Secure KeyStore/Keychain
            await Keychain.setGenericPassword('session', accessToken, { service: 'accessToken' });
            await Keychain.setGenericPassword('session', refreshToken, { service: 'refreshToken' });

            // Non-sensitive profile data stays in AsyncStorage
            await AsyncStorage.setItem('user', JSON.stringify(userData));

            navigation.replace('Dashboard');
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Login Error',
                message: error.response?.data?.message || 'Invalid credentials or connection error.',
                confirmText: 'OK',
                type: 'danger',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.idToken;

            if (!idToken) {
                throw new Error('Google Sign-In failed: No ID Token received');
            }

            const response = await apiClient.post('/auth/google-login', { idToken });
            const { accessToken, refreshToken, user: userData } = response.data;

            // Store tokens in Secure KeyStore/Keychain
            await Keychain.setGenericPassword('session', accessToken, { service: 'accessToken' });
            await Keychain.setGenericPassword('session', refreshToken, { service: 'refreshToken' });

            await AsyncStorage.setItem('user', JSON.stringify(userData));

            navigation.replace('Dashboard');
        } catch (error) {
            let errorMsg = error.message || 'Google login failed';
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                return;
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                errorMsg = 'Google Play Services not available or outdated';
            }

            setModalConfig({
                visible: true,
                title: 'Google Login',
                message: errorMsg,
                confirmText: 'OK',
                type: 'danger',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Welcome back</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>
                </View>

                <View style={styles.card}>
                    <AppInput
                        label="Email Address"
                        placeholder="name@company.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                    <AppInput
                        label="Password"
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={styles.forgotBtn}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    >
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <AppButton
                        title="Sign In"
                        onPress={handleLogin}
                        loading={loading}
                    />

                    <View style={styles.divider}>
                        <View style={styles.line} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.line} />
                    </View>

                    <AppButton
                        title="Sign in with Google"
                        variant="secondary"
                        onPress={handleGoogleLogin}
                        loading={loading}
                    />
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
        </KeyboardAvoidingView>
    );
};

import { normalize, moderateScale, verticalScale } from '../theme/Scaling';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: moderateScale(24),
        justifyContent: 'center',
    },
    header: {
        marginBottom: verticalScale(40),
        alignItems: 'center',
    },
    title: {
        fontSize: normalize(32),
        fontWeight: '800',
        color: Colors.text,
        marginBottom: moderateScale(8),
    },
    subtitle: {
        fontSize: normalize(16),
        color: Colors.textLight,
        textAlign: 'center',
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: moderateScale(24),
        padding: moderateScale(24),
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: verticalScale(20),
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    dividerText: {
        marginHorizontal: moderateScale(10),
        color: Colors.textLight,
        fontSize: normalize(14),
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginBottom: verticalScale(20),
        marginTop: verticalScale(-8),
    },
    forgotText: {
        color: Colors.primary,
        fontSize: normalize(14),
        fontWeight: '600',
    },
});

export default LoginScreen;
