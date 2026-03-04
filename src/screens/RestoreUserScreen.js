import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/Colors';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const RestoreUserScreen = ({ navigation, route }) => {
    const { userId } = route.params;
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [companies, setCompanies] = useState([]);
    const [roles, setRoles] = useState([]);
    const [admins, setAdmins] = useState([]);

    const [formData, setFormData] = useState({
        entity_id: '',
        role_id: '',
        admin_id: ''
    });

    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [rolesRes, companiesRes] = await Promise.all([
                    apiClient.get('/roles'),
                    apiClient.get('/companies')
                ]);
                setRoles(rolesRes.data);
                setCompanies(companiesRes.data);
            } catch (error) {
                console.error('Failed to fetch initial data:', error);
            } finally {
                setInitialLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const fetchAdmins = async () => {
            if (formData.entity_id) {
                try {
                    // Assuming there's an endpoint or filter for this
                    const response = await apiClient.get(`/users?entity_id=${formData.entity_id}`);
                    // Filter for users who are admins
                    const companyAdmins = response.data.filter(u => u.Role?.name === 'ADMIN');
                    setAdmins(companyAdmins);
                } catch (error) {
                    console.error('Failed to fetch admins:', error);
                }
            } else {
                setAdmins([]);
            }
        };
        fetchAdmins();
    }, [formData.entity_id]);

    const handleRestore = async () => {
        if (!formData.entity_id || !formData.role_id) {
            setModalConfig({
                visible: true,
                title: 'Required Fields',
                message: 'Please select a company and a role.',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        const selectedRole = roles.find(r => r.id === formData.role_id);
        if ((selectedRole?.name === 'L1' || selectedRole?.name === 'L2') && !formData.admin_id) {
            setModalConfig({
                visible: true,
                title: 'Parent Required',
                message: `Please select a ${selectedRole.name === 'L1' ? 'Parent Admin' : 'Reporting Manager (L1)'} for this user.`,
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setModalConfig({
            visible: true,
            title: 'Restore User',
            message: 'Are you sure you want to restore this user with these settings?',
            confirmText: 'Restore',
            type: 'success',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    await apiClient.post(`/users/${userId}/restore`, formData);
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: 'User has been restored successfully.',
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
                        message: error.response?.data?.message || 'Failed to restore user',
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

    if (initialLoading) {
        return (
            <View style={styles.centerLoader}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const selectedRole = roles.find(r => r.id === formData.role_id);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="x" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Restore Configuration</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Assign Company</Text>
                <View style={styles.grid}>
                    <TouchableOpacity
                        style={[
                            styles.option,
                            (formData.entity_id === null || formData.entity_id === '') && styles.optionSelected
                        ]}
                        onPress={() => setFormData({ ...formData, entity_id: null, admin_id: '', role_id: roles.find(r => r.name === 'SUPERADMIN')?.id || '' })}
                    >
                        <Text style={[
                            styles.optionText,
                            (formData.entity_id === null || formData.entity_id === '') && styles.optionTextSelected
                        ]}>System (Global)</Text>
                    </TouchableOpacity>
                    {companies.map(c => (
                        <TouchableOpacity
                            key={c.id}
                            style={[
                                styles.option,
                                formData.entity_id === c.id && styles.optionSelected
                            ]}
                            onPress={() => setFormData({ ...formData, entity_id: c.id, admin_id: '' })}
                        >
                            <Text style={[
                                styles.optionText,
                                formData.entity_id === c.id && styles.optionTextSelected
                            ]}>{c.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>Select Role</Text>
                <View style={styles.grid}>
                    {roles.filter(r => {
                        if (!formData.entity_id) return r.name === 'SUPERADMIN';
                        return ['ADMIN', 'L1', 'L2'].includes(r.name);
                    }).map(r => (
                        <TouchableOpacity
                            key={r.id}
                            style={[
                                styles.option,
                                formData.role_id === r.id && styles.optionSelected
                            ]}
                            onPress={() => setFormData({ ...formData, role_id: r.id })}
                        >
                            <Text style={[
                                styles.optionText,
                                formData.role_id === r.id && styles.optionTextSelected
                            ]}>{r.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {(selectedRole?.name === 'L1' || selectedRole?.name === 'L2') && formData.entity_id && (
                    <>
                        <Text style={styles.sectionTitle}>
                            {selectedRole?.name === 'L1' ? 'Select Parent Admin' : 'Select Reporting Manager (L1)'}
                        </Text>
                        {admins.length > 0 ? (
                            <View style={styles.grid}>
                                {admins.map(a => (
                                    <TouchableOpacity
                                        key={a.id}
                                        style={[
                                            styles.option,
                                            formData.admin_id === a.id && styles.optionSelected
                                        ]}
                                        onPress={() => setFormData({ ...formData, admin_id: a.id })}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            formData.admin_id === a.id && styles.optionTextSelected
                                        ]}>{a.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.emptyMsg}>No admins found for this company.</Text>
                        )}
                    </>
                )}

                <AppButton
                    title="Restore User"
                    onPress={handleRestore}
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
    content: { padding: 20 },
    sectionTitle: {
        fontSize: normalize(14),
        fontWeight: '700',
        color: Colors.textLight,
        marginBottom: 12,
        marginTop: 20,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    option: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        minWidth: '45%',
    },
    optionSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    optionText: {
        fontSize: normalize(13),
        fontWeight: '600',
        color: Colors.text,
        textAlign: 'center',
    },
    optionTextSelected: {
        color: Colors.white,
    },
    submitBtn: { marginTop: 40, marginBottom: 20 },
    centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
    emptyMsg: { color: Colors.danger, fontSize: 12, fontStyle: 'italic' }
});

export default RestoreUserScreen;
