import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { Colors } from '../theme/Colors';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const ManageRolesScreen = ({ navigation }) => {
    const [roles, setRoles] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', description: '' });
    const [editingRole, setEditingRole] = useState(null);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    const fetchRoles = async () => {
        try {
            const response = await apiClient.get('/roles');
            setRoles(response.data);
        } catch (error) {
            console.error('Failed to fetch roles:', error);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchRoles();
        setRefreshing(false);
    };

    const handleSubmit = async () => {
        if (!newRole.name) {
            setModalConfig({
                visible: true,
                title: 'Required',
                message: 'Role name is required',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setModalConfig({
            visible: true,
            title: editingRole ? 'Update Role' : 'Create Role',
            message: `Are you sure you want to ${editingRole ? 'save changes to' : 'create'} this role?`,
            confirmText: editingRole ? 'Update' : 'Create',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    if (editingRole) {
                        await apiClient.put(`/roles/${editingRole.id}`, newRole);
                        setEditingRole(null);
                    } else {
                        await apiClient.post('/roles', newRole);
                    }
                    setNewRole({ name: '', description: '' });
                    fetchRoles();
                } catch (error) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: `Failed to ${editingRole ? 'update' : 'add'} role`,
                        confirmText: 'OK',
                        type: 'danger',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                }
            }
        });
    };

    const handleEdit = (role) => {
        if (role.is_system) {
            setModalConfig({
                visible: true,
                title: 'Restricted',
                message: 'System roles cannot be modified',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }
        setEditingRole(role);
        setNewRole({ name: role.name, description: role.description });
    };

    const handleDelete = (id, isSystem) => {
        if (isSystem) {
            setModalConfig({
                visible: true,
                title: 'Restricted',
                message: 'System roles cannot be deleted',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }
        setModalConfig({
            visible: true,
            title: 'Delete Role',
            message: 'Are you sure you want to delete this role?',
            confirmText: 'Delete',
            type: 'danger',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    await apiClient.delete(`/roles/${id}`);
                    fetchRoles();
                } catch (error) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: 'Failed to delete role',
                        confirmText: 'OK',
                        type: 'danger',
                        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
                    });
                }
            }
        });
    };

    const renderItem = ({ item }) => (
        <View style={styles.roleCard}>
            <View style={styles.roleInfo}>
                <Text style={styles.roleName}>{item.name}</Text>
                <Text style={styles.roleDesc}>{item.description || 'No description'}</Text>
            </View>
            {!item.is_system && (
                <View style={styles.actionGroup}>
                    <TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconBtn}>
                        <Icon name="edit-2" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id, item.is_system)} style={styles.iconBtn}>
                        <Icon name="trash-2" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="chevron-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Manage Roles</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.addSection}>
                <Text style={styles.sectionLabel}>{editingRole ? 'Edit Role' : 'Create New Role'}</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Role Name (e.g. CONSULTANT)"
                    value={newRole.name}
                    onChangeText={(v) => setNewRole({ ...newRole, name: v })}
                    placeholderTextColor={Colors.textLight}
                />
                <TextInput
                    style={[styles.input, { height: 60 }]}
                    placeholder="Description"
                    multiline
                    value={newRole.description}
                    onChangeText={(v) => setNewRole({ ...newRole, description: v })}
                    placeholderTextColor={Colors.textLight}
                />
                <View style={styles.btnRow}>
                    <TouchableOpacity style={[styles.submitBtn, editingRole && { flex: 2 }]} onPress={handleSubmit}>
                        <Text style={styles.addBtnText}>{editingRole ? 'Update Role' : 'Create Role'}</Text>
                    </TouchableOpacity>
                    {editingRole && (
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => {
                                setEditingRole(null);
                                setNewRole({ name: '', description: '' });
                            }}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={roles}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />

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
    title: { fontSize: normalize(18), fontWeight: '700', color: Colors.text },
    addSection: {
        padding: 20,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textLight, marginBottom: 12, textTransform: 'uppercase' },
    input: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        color: Colors.text,
        fontSize: 14,
    },
    btnRow: { flexDirection: 'row', gap: 10 },
    submitBtn: {
        backgroundColor: Colors.primary,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        flex: 1,
    },
    cancelBtn: {
        backgroundColor: Colors.border,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        flex: 1,
    },
    addBtnText: { color: Colors.white, fontWeight: '700' },
    cancelBtnText: { color: Colors.text, fontWeight: '600' },
    list: { padding: 20 },
    roleCard: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
    },
    roleInfo: { flex: 1 },
    roleName: { fontSize: 16, fontWeight: '700', color: Colors.primary },
    roleDesc: { fontSize: 12, color: Colors.textLight, marginTop: 4 },
    actionGroup: { flexDirection: 'row' },
    iconBtn: { padding: 5, marginLeft: 10 },
});

export default ManageRolesScreen;
