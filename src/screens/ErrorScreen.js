import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/Colors';
import { moderateScale, normalize, verticalScale } from '../theme/Scaling';

const ErrorScreen = ({ route, navigation }) => {
    const { message } = route.params || {};
    
    const onRetry = () => {
        navigation.navigate('Dashboard');
    };

    const onBack = () => {
        navigation.goBack();
    };
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                </View>
                <Text style={styles.title}>Oops! Something went wrong</Text>
                <Text style={styles.message}>
                    {message || "We're having trouble connecting to the server. Please check your internet or try again later."}
                </Text>

                <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                    <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: moderateScale(24),
    },
    content: {
        width: '100%',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: moderateScale(24),
        padding: moderateScale(32),
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    iconContainer: {
        width: moderateScale(80),
        height: moderateScale(80),
        borderRadius: moderateScale(40),
        backgroundColor: Colors.danger + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: verticalScale(24),
    },
    errorIcon: {
        fontSize: normalize(40),
    },
    title: {
        fontSize: normalize(22),
        fontWeight: '800',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: moderateScale(12),
    },
    message: {
        fontSize: normalize(15),
        color: Colors.textLight,
        textAlign: 'center',
        lineHeight: normalize(22),
        marginBottom: verticalScale(32),
    },
    retryBtn: {
        backgroundColor: Colors.primary,
        width: '100%',
        paddingVertical: moderateScale(16),
        borderRadius: moderateScale(12),
        alignItems: 'center',
        marginBottom: moderateScale(12),
    },
    retryBtnText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: normalize(16),
    },
    backBtn: {
        width: '100%',
        paddingVertical: moderateScale(16),
        alignItems: 'center',
    },
    backBtnText: {
        color: Colors.textLight,
        fontWeight: '600',
        fontSize: normalize(15),
    },
});

export default ErrorScreen;
