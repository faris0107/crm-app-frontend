import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const PRESET_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#64748B', '#111827', '#F97316'
];

const AddEditStatusScreen = ({ route, navigation }) => {
    const status = route.params?.status;
    const isEdit = !!status;

    const [form, setForm] = useState({
        name: status?.name || '',
        color: status?.color || PRESET_COLORS[0],
        active: status?.active ?? true
    });
    const [loading, setLoading] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const handleSave = async () => {
        if (!form.name) {
            setModalConfig({
                visible: true,
                title: 'Required',
                message: 'Please enter a status name',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setModalConfig({
            visible: true,
            title: isEdit ? 'Update Status' : 'Create Status',
            message: `Are you sure you want to ${isEdit ? 'update' : 'create'} this status?`,
            confirmText: isEdit ? 'Update' : 'Create',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    if (isEdit) {
                        await apiClient.put(`/statuses/${status.id}`, form);
                    } else {
                        await apiClient.post('/statuses', form);
                    }
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: `Status ${isEdit ? 'updated' : 'created'} successfully`,
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
                        message: error.response?.data?.message || 'Failed to save status',
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
                    <Icon name="chevron-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>{isEdit ? 'Edit Status' : 'Add Status'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <AppInput
                    label="Status Name"
                    placeholder="e.g. In Progress"
                    value={form.name}
                    onChangeText={(v) => setForm({ ...form, name: v })}
                />

                <Text style={styles.label}>Select Color</Text>
                <View style={styles.colorGrid}>
                    {PRESET_COLORS.map(color => (
                        <TouchableOpacity
                            key={color}
                            style={[
                                styles.colorOption,
                                { backgroundColor: color },
                                form.color === color && styles.selectedColor
                            ]}
                            onPress={() => setForm({ ...form, color })}
                        >
                            {form.color === color && (
                                <Icon name="check" size={16} color={Colors.white} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                <AppButton
                    title={isEdit ? "Update Status" : "Create Status"}
                    onPress={handleSave}
                    loading={loading}
                    style={styles.saveBtn}
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
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 12,
        marginTop: 8,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    colorOption: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginBottom: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedColor: {
        borderColor: Colors.text,
    },
    saveBtn: { marginTop: 20 },
});

export default AddEditStatusScreen;
