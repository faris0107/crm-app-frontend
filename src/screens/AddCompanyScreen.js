import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { moderateScale, normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const AddCompanyScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        primary_email: '',
        primary_mobile: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
    });
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const handleCreate = async () => {
        // Simple validation
        const required = ['name', 'code', 'admin_name', 'admin_email', 'admin_password'];
        for (const field of required) {
            if (!formData[field]) {
                setModalConfig({
                    visible: true,
                    title: 'Incomplete Form',
                    message: `Please fill in all required fields marked with *.`,
                    confirmText: 'OK',
                    onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                });
                return;
            }
        }

        setModalConfig({
            visible: true,
            title: 'Create Company',
            message: 'Are you sure all details are correct? This will create a new company and its admin account.',
            confirmText: 'Create',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    await apiClient.post('/companies', formData);
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: 'Company and Admin created successfully',
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
                        message: error.response?.data?.message || 'Failed to create company',
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
                <Text style={styles.title}>Add New Company</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Company Details</Text>
                <AppInput
                    label="Company Name *"
                    placeholder="e.g. Acme Corp"
                    value={formData.name}
                    onChangeText={(v) => setFormData({ ...formData, name: v })}
                />
                <AppInput
                    label="Company Code *"
                    placeholder="e.g. ACME"
                    value={formData.code}
                    onChangeText={(v) => setFormData({ ...formData, code: v.toUpperCase() })}
                />
                <AppInput
                    label="Business Email"
                    placeholder="contact@company.com"
                    value={formData.primary_email}
                    onChangeText={(v) => setFormData({ ...formData, primary_email: v })}
                />
                <AppInput
                    label="Business Mobile"
                    placeholder="+91 9876543210"
                    value={formData.primary_mobile}
                    onChangeText={(v) => setFormData({ ...formData, primary_mobile: v })}
                />

                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Primary Admin User</Text>
                <AppInput
                    label="Admin Full Name *"
                    placeholder="John Doe"
                    value={formData.admin_name}
                    onChangeText={(v) => setFormData({ ...formData, admin_name: v })}
                />
                <AppInput
                    label="Admin Email *"
                    placeholder="admin@company.com"
                    value={formData.admin_email}
                    onChangeText={(v) => setFormData({ ...formData, admin_email: v })}
                />
                <AppInput
                    label="Admin Password *"
                    placeholder="••••••••"
                    secureTextEntry
                    value={formData.admin_password}
                    onChangeText={(v) => setFormData({ ...formData, admin_password: v })}
                />

                <AppButton
                    title="Create Company"
                    onPress={handleCreate}
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
    backBtn: {
        padding: 4,
    },
    title: {
        fontSize: normalize(18),
        fontWeight: '700',
        color: Colors.text,
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: normalize(14),
        fontWeight: '700',
        color: Colors.textLight,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    submitBtn: {
        marginTop: 32,
        marginBottom: 40,
    },
});

export default AddCompanyScreen;
