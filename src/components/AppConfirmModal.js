import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Colors } from '../theme/Colors';
import { normalize } from '../theme/Scaling';
import Icon from 'react-native-vector-icons/Feather';

const AppConfirmModal = ({
    visible,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'default' // 'default', 'danger', 'success'
}) => {
    const isDanger = type === 'danger';
    const isSuccess = type === 'success';

    const getIcon = () => {
        if (isDanger) return 'alert-triangle';
        if (isSuccess) return 'check-circle';
        return 'help-circle';
    };

    const getColor = () => {
        if (isDanger) return Colors.danger;
        if (isSuccess) return Colors.success;
        return Colors.primary;
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={[styles.iconContainer, { backgroundColor: getColor() + '15' }]}>
                        <Icon name={getIcon()} size={28} color={getColor()} />
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonRow}>
                        {onCancel && (
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={onCancel}
                            >
                                <Text style={styles.cancelText}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.confirmBtn, { backgroundColor: getColor() }]}
                            onPress={onConfirm}
                        >
                            <Text style={styles.confirmText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    title: {
        fontSize: normalize(18),
        fontWeight: '800',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 8
    },
    message: {
        fontSize: normalize(14),
        color: Colors.textLight,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12
    },
    confirmBtn: {
        flex: 2,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '700'
    },
    cancelBtn: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border
    },
    cancelText: {
        color: Colors.text,
        fontSize: 15,
        fontWeight: '600'
    }
});

export default AppConfirmModal;
