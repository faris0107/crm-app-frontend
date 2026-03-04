import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Colors } from '../theme/Colors';
import { moderateScale, normalize } from '../theme/Scaling';

const AppButton = ({ title, onPress, loading, variant = 'primary', style }) => {
    return (
        <Pressable
            onPress={onPress}
            disabled={loading}
            style={({ pressed }) => [
                styles.button,
                variant === 'secondary' ? styles.secondary : styles.primary,
                pressed && styles.pressed,
                loading && styles.disabled,
                style
            ]}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'secondary' ? Colors.primary : Colors.white} />
            ) : (
                <Text style={[
                    styles.text,
                    variant === 'secondary' ? styles.secondaryText : styles.primaryText
                ]}>
                    {title}
                </Text>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingVertical: moderateScale(14),
        paddingHorizontal: moderateScale(20),
        borderRadius: moderateScale(12),
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: moderateScale(8),
        ...View.shadows // Placeholder for potential elevation/shadow logic
    },
    primary: {
        backgroundColor: Colors.primary,
    },
    secondary: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }]
    },
    disabled: {
        opacity: 0.5
    },
    text: {
        fontSize: normalize(16),
        fontWeight: '600',
    },
    primaryText: {
        color: Colors.white,
    },
    secondaryText: {
        color: Colors.text,
    },
});

export default AppButton;
