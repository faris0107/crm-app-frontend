import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const EditCompanyScreen = ({ route, navigation }) => {
    const { company } = route.params;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: company.name,
        code: company.code,
        primary_email: company.primary_email || '',
        primary_mobile: company.primary_mobile || '',
        active: company.active
    });
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const handleUpdate = async () => {
        if (!formData.name || !formData.code) {
            setModalConfig({
                visible: true,
                title: 'Required',
                message: 'Company Name and Code are required fields.',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setModalConfig({
            visible: true,
            title: 'Update Company',
            message: 'Save changes to this company?',
            confirmText: 'Update',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    await apiClient.put(`/companies/${company.id}`, formData);
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: 'Company updated successfully',
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
                        message: error.response?.data?.message || 'Failed to update company',
                        confirmText: 'OK',
                        type: 'danger',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="x" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Edit Company</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <AppInput
                    label="Company Name *"
                    value={formData.name}
                    onChangeText={(v) => setFormData({ ...formData, name: v })}
                />
                <AppInput
                    label="Company Code *"
                    value={formData.code}
                    onChangeText={(v) => setFormData({ ...formData, code: v.toUpperCase() })}
                />
                <AppInput
                    label="Business Email"
                    value={formData.primary_email}
                    onChangeText={(v) => setFormData({ ...formData, primary_email: v })}
                />
                <AppInput
                    label="Business Mobile"
                    value={formData.primary_mobile}
                    onChangeText={(v) => setFormData({ ...formData, primary_mobile: v })}
                />

                <View style={styles.statusToggle}>
                    <Text style={styles.statusLabel}>Active Status</Text>
                    <TouchableOpacity
                        style={[styles.toggleBtn, { backgroundColor: formData.active ? Colors.success : Colors.border }]}
                        onPress={() => setFormData({ ...formData, active: !formData.active })}
                    >
                        <View style={[styles.toggleCircle, { alignSelf: formData.active ? 'flex-end' : 'flex-start' }]} />
                    </TouchableOpacity>
                </View>

                <AppButton
                    title="Update Details"
                    onPress={handleUpdate}
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
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
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
    content: { padding: 20 },
    statusToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 12,
    },
    statusLabel: { fontSize: normalize(14), fontWeight: '600', color: Colors.text },
    toggleBtn: {
        width: 50,
        height: 28,
        borderRadius: 14,
        padding: 4,
        justifyContent: 'center',
    },
    toggleCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.white,
    },
    submitBtn: { marginTop: 32 },
});

export default EditCompanyScreen;
