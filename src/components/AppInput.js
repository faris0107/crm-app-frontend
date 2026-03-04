import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '../theme/Colors';
import { moderateScale, normalize } from '../theme/Scaling';
import Icon from 'react-native-vector-icons/Feather';

const AppInput = ({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, error }) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[styles.inputContainer, error && styles.errorBorder]}>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={secureTextEntry && !isPasswordVisible}
                    keyboardType={keyboardType}
                    autoCapitalize="none"
                />
                {secureTextEntry && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        style={styles.iconContainer}
                    >
                        <Icon
                            name={isPasswordVisible ? 'eye' : 'eye-off'}
                            size={moderateScale(20)}
                            color={Colors.textLight}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: moderateScale(8),
        width: '100%',
    },
    label: {
        fontSize: normalize(14),
        fontWeight: '500',
        color: Colors.text,
        marginBottom: moderateScale(6),
        marginLeft: moderateScale(4),
    },
    inputContainer: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: moderateScale(12),
        paddingHorizontal: moderateScale(14),
        minHeight: moderateScale(54),
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        fontSize: normalize(16),
        color: Colors.text,
        paddingVertical: Platform.OS === 'ios' ? moderateScale(12) : moderateScale(8),
    },
    iconContainer: {
        padding: moderateScale(4),
    },
    errorBorder: {
        borderColor: Colors.danger,
    },
    errorText: {
        color: Colors.danger,
        fontSize: normalize(12),
        marginTop: moderateScale(4),
        marginLeft: moderateScale(4),
    },
});

export default AppInput;
