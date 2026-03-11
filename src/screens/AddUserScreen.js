import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AddUserScreen = ({ navigation, route }) => {
    const editUser = route.params?.user;
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [roles, setRoles] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [allL1, setAllL1] = useState([]);
    const [selectedAdminId, setSelectedAdminId] = useState(null);
    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [formData, setFormData] = useState({
        name: editUser?.name || '',
        email: editUser?.email || '',
        password: '',
        user_code: editUser?.user_code || '',
        role_id: editUser?.role_id || '',
        entity_id: editUser?.entity_id || '',
        parent_id: editUser?.parent_id || ''
    });
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        const fetchContext = async () => {
            const userDataString = await AsyncStorage.getItem('user');
            if (userDataString) {
                const parsed = JSON.parse(userDataString);
                if (parsed.role) parsed.role = parsed.role.toUpperCase();
                setCurrentUser(parsed);

                // Fetch active context for SuperAdmin
                let activeId = null;
                if (!parsed.entity_id) {
                    activeId = await AsyncStorage.getItem('activeCompanyId');
                    setActiveCompanyId(activeId);
                }

                // If switched to a company or is a tenant user, lock the company
                const effectiveEntityId = activeId || parsed.entity_id;
                if (effectiveEntityId && !editUser) {
                    setFormData(prev => ({ ...prev, entity_id: effectiveEntityId }));
                }

                // Fetch data needed for selection
                try {
                    const [roleRes, compRes] = await Promise.all([
                        apiClient.get('/roles'),
                        !parsed.entity_id ? apiClient.get('/companies') : Promise.resolve({ data: [] })
                    ]);

                    setRoles(roleRes.data);
                    if (!parsed.entity_id) setCompanies(compRes.data);

                    // If user is Admin, they are the parent for any staff they create
                    if (parsed.role === 'ADMIN') {
                        setAdmins([parsed]);
                        setFormData(prev => ({ ...prev, parent_id: parsed.id }));
                    }

                    // Default role logic
                    if (!editUser && !formData.role_id) {
                        let defaultRoleName = 'L1';
                        if (parsed.role === 'L1') defaultRoleName = 'L2';
                        if (parsed.role === 'L2') defaultRoleName = 'USER'; // Though L2s shouldn't usually create users
                        if (!parsed.entity_id) defaultRoleName = 'ADMIN';

                        const defaultRole = roleRes.data.find(r => r.name === defaultRoleName);
                        if (defaultRole) setFormData(prev => ({ ...prev, role_id: defaultRole.id }));
                    }
                } catch (error) {
                    console.error('Failed to fetch roles/companies', error);
                }
            }
        };
        fetchContext();
    }, []);

    // Fetch admins when company changes
    useEffect(() => {
        const fetchParents = async () => {
            if (formData.entity_id && currentUser?.role !== 'STAFF') {
                try {
                    const response = await apiClient.get(`/users?entity_id=${formData.entity_id}`);
                    const selectedRoleName = roles.find(r => r.id === formData.role_id)?.name;

                    let filteredParents = [];
                    if (selectedRoleName === 'L1') {
                        // L1 needs an ADMIN parent
                        let adminsList = response.data.filter(u => u.Role?.name === 'ADMIN');
                        if (currentUser.role === 'ADMIN') {
                            adminsList = adminsList.filter(u => u.id === currentUser.id);
                        }
                        setAdmins(adminsList);
                        if (adminsList.length === 1) {
                            setFormData(prev => ({ ...prev, parent_id: adminsList[0].id }));
                        }
                    } else if (selectedRoleName === 'L2') {
                        // L2 needs an L1 parent
                        let adminsList = response.data.filter(u => u.Role?.name === 'ADMIN');
                        let l1List = response.data.filter(u => u.Role?.name === 'L1');

                        if (currentUser.role === 'ADMIN') {
                            adminsList = adminsList.filter(u => u.id === currentUser.id);
                            l1List = l1List.filter(u => u.parent_id === currentUser.id);
                        } else if (currentUser.role === 'L1') {
                            // Find 'Me' in the latest list to get the most accurate parent_id
                            const me = response.data.find(u => String(u.id) === String(currentUser.id));
                            const myParentId = me?.parent_id || currentUser.parent_id;

                            const parentAdmin = adminsList.find(a => String(a.id) === String(myParentId));

                            if (parentAdmin) {
                                // Strictly show only the direct parent
                                adminsList = [parentAdmin];
                                setSelectedAdminId(parentAdmin.id);
                            } else {
                                // If parent not found, show nothing to maintain privacy
                                adminsList = [];
                            }
                            l1List = l1List.filter(u => u.id === currentUser.id);
                        }

                        setAdmins(adminsList);
                        setAllL1(l1List);

                        // Auto-selection logic
                        if (currentUser.role === 'ADMIN') {
                            setSelectedAdminId(currentUser.id);
                        } else if (currentUser.role === 'L1') {
                            const pId = currentUser.parent_id || (adminsList.length === 1 ? adminsList[0].id : null);
                            setSelectedAdminId(pId);
                            setFormData(prev => ({ ...prev, parent_id: currentUser.id }));
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch parent candidates:', error);
                }
            }
        };
        fetchParents();
    }, [formData.entity_id, formData.role_id, roles, currentUser]);

    const handleSubmit = async () => {
        if (!formData.name || !formData.email || (!editUser && !formData.password) || !formData.role_id) {
            setModalConfig({
                visible: true,
                title: 'Missing Information',
                message: 'Please fill in all required fields marked with *',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        const selectedRole = roles.find(r => r.id === formData.role_id);
        if (['L1', 'L2'].includes(selectedRole?.name) && !formData.parent_id) {
            setModalConfig({
                visible: true,
                title: 'Missing Assignment',
                message: `Please select a ${selectedRole.name === 'L1' ? 'Parent Admin' : 'Reporting Manager (L1)'} for this account.`,
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setModalConfig({
            visible: true,
            title: editUser ? 'Update User' : 'Add User',
            message: editUser ? 'Save changes for this user account?' : 'Create this new user account?',
            confirmText: editUser ? 'Save' : 'Create',
            type: 'default',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    if (editUser) {
                        await apiClient.put(`/users/${editUser.id}`, formData);
                    } else {
                        await apiClient.post('/users', formData);
                    }
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: `User ${editUser ? 'updated' : 'created'} successfully`,
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
                        message: error.response?.data?.message || `Failed to ${editUser ? 'update' : 'add'} user`,
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

    const availableRoles = roles.filter(r => {
        if (!currentUser) return false;

        const isSystem = !currentUser.entity_id;
        const currentRole = currentUser.role;

        // Create L1 for ADMIN, L2 for L1
        if (!['ADMIN', 'L1', 'L2'].includes(r.name)) return false;

        if (isSystem) {
            // SuperAdmin can create ADMIN, L1, L2
            return true;
        }

        if (currentRole === 'ADMIN') {
            // Admin can create L1 and L2
            return r.name === 'L1' || r.name === 'L2';
        }

        if (currentRole === 'L1') {
            // L1 can create L2
            return r.name === 'L2';
        }

        return false;
    });

    const [showAdminDropdown, setShowAdminDropdown] = useState(false);
    const [showL1Dropdown, setShowL1Dropdown] = useState(false);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="x" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>{editUser ? 'Edit User' : 'Add New User'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <AppInput
                    label="Full Name *"
                    placeholder="Enter user's name"
                    value={formData.name}
                    onChangeText={(v) => setFormData({ ...formData, name: v })}
                />
                <AppInput
                    label="Email Address *"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChangeText={(v) => setFormData({ ...formData, email: v })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
                <AppInput
                    label={editUser ? "Reset Password (optional)" : "Temporary Password *"}
                    placeholder="••••••••"
                    secureTextEntry
                    value={formData.password}
                    onChangeText={(v) => setFormData({ ...formData, password: v })}
                />
                <AppInput
                    label="User Code"
                    placeholder="e.g. ADM001"
                    value={formData.user_code}
                    onChangeText={(v) => setFormData({ ...formData, user_code: v.toUpperCase() })}
                />

                <Text style={styles.label}>Select Role *</Text>
                <View style={styles.roleGrid}>
                    {availableRoles.map((r) => (
                        <TouchableOpacity
                            key={r.id}
                            style={[
                                styles.roleOption,
                                formData.role_id === r.id && styles.roleOptionSelected
                            ]}
                            onPress={() => setFormData({ ...formData, role_id: r.id })}
                        >
                            <Text style={[
                                styles.roleOptionText,
                                formData.role_id === r.id && styles.roleOptionTextSelected
                            ]}>{r.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {roles.find(r => r.id === formData.role_id)?.name === 'L1' && (
                    <>
                        <Text style={styles.label}>Reporting Admin *</Text>
                        <TouchableOpacity
                            style={styles.dropdownHeader}
                            onPress={() => setShowAdminDropdown(!showAdminDropdown)}
                        >
                            <Text style={styles.selectedAdminText}>
                                {formData.parent_id
                                    ? admins.find(a => a.id === formData.parent_id)?.name || 'Select an Admin'
                                    : 'Choose Parent Admin'}
                            </Text>
                            <Icon name={showAdminDropdown ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
                        </TouchableOpacity>

                        {showAdminDropdown && (
                            <View style={styles.dropdownContent}>
                                {admins.length > 0 ? admins.map((a) => (
                                    <TouchableOpacity
                                        key={a.id}
                                        style={[
                                            styles.adminItem,
                                            formData.parent_id === a.id && styles.adminItemSelected
                                        ]}
                                        onPress={() => {
                                            setFormData({ ...formData, parent_id: a.id });
                                            setShowAdminDropdown(false);
                                        }}
                                    >
                                        <View style={styles.adminItemInfo}>
                                            <Text style={[
                                                styles.adminName,
                                                formData.parent_id === a.id && styles.adminNameSelected
                                            ]}>{a.name}</Text>
                                            <Text style={styles.adminEmail}>{a.email}</Text>
                                        </View>
                                        {formData.parent_id === a.id && (
                                            <Icon name="check" size={16} color={Colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                )) : (
                                    <View style={styles.emptyDropdown}>
                                        <Text style={styles.emptyMsg}>No Admins found.</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </>
                )}

                {roles.find(r => r.id === formData.role_id)?.name === 'L2' && (
                    <>
                        {/* Step 1: Select Admin */}
                        <Text style={styles.label}>Choose Admin *</Text>
                        <TouchableOpacity
                            style={styles.dropdownHeader}
                            onPress={() => setShowAdminDropdown(!showAdminDropdown)}
                        >
                            <Text style={styles.selectedAdminText}>
                                {selectedAdminId
                                    ? admins.find(a => a.id === selectedAdminId)?.name || 'Select an Admin'
                                    : 'Choose Parent Admin'}
                            </Text>
                            <Icon name={showAdminDropdown ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
                        </TouchableOpacity>

                        {showAdminDropdown && (
                            <View style={styles.dropdownContent}>
                                {admins.length > 0 ? admins.map((a) => (
                                    <TouchableOpacity
                                        key={a.id}
                                        style={[
                                            styles.adminItem,
                                            selectedAdminId === a.id && styles.adminItemSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedAdminId(a.id);
                                            setFormData({ ...formData, parent_id: '' });
                                            setShowAdminDropdown(false);
                                        }}
                                    >
                                        <View style={styles.adminItemInfo}>
                                            <Text style={styles.adminName}>{a.name}</Text>
                                            <Text style={styles.adminEmail}>{a.email}</Text>
                                        </View>
                                        {selectedAdminId === a.id && <Icon name="check" size={16} color={Colors.primary} />}
                                    </TouchableOpacity>
                                )) : (
                                    <View style={styles.emptyDropdown}><Text style={styles.emptyMsg}>No Admins found.</Text></View>
                                )}
                            </View>
                        )}

                        {/* Step 2: Select L1 */}
                        <Text style={styles.label}>Reporting L1 Manager *</Text>
                        <TouchableOpacity
                            style={[styles.dropdownHeader, !selectedAdminId && { opacity: 0.5 }]}
                            onPress={() => selectedAdminId && setShowL1Dropdown(!showL1Dropdown)}
                            disabled={!selectedAdminId}
                        >
                            <Text style={styles.selectedAdminText}>
                                {formData.parent_id
                                    ? allL1.find(l => l.id === formData.parent_id)?.name || 'Select L1'
                                    : (selectedAdminId ? 'Choose L1' : 'Select Admin First')}
                            </Text>
                            <Icon name={showL1Dropdown ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
                        </TouchableOpacity>

                        {showL1Dropdown && (
                            <View style={styles.dropdownContent}>
                                {allL1.filter(l => l.parent_id === selectedAdminId).length > 0 ?
                                    allL1.filter(l => l.parent_id === selectedAdminId).map((l) => (
                                        <TouchableOpacity
                                            key={l.id}
                                            style={[
                                                styles.adminItem,
                                                formData.parent_id === l.id && styles.adminItemSelected
                                            ]}
                                            onPress={() => {
                                                setFormData({ ...formData, parent_id: l.id });
                                                setShowL1Dropdown(false);
                                            }}
                                        >
                                            <View style={styles.adminItemInfo}>
                                                <Text style={styles.adminName}>{l.name}</Text>
                                                <Text style={styles.adminEmail}>{l.email}</Text>
                                            </View>
                                            {formData.parent_id === l.id && <Icon name="check" size={16} color={Colors.primary} />}
                                        </TouchableOpacity>
                                    )) : (
                                        <View style={styles.emptyDropdown}>
                                            <Text style={styles.emptyMsg}>No L1 Managers found under this Admin.</Text>
                                        </View>
                                    )}
                            </View>
                        )}
                    </>
                )}

                {!currentUser?.entity_id && !activeCompanyId && (
                    <>
                        <Text style={styles.label}>Select Company *</Text>
                        <View style={styles.companyGrid}>
                            <TouchableOpacity
                                style={[
                                    styles.companyOption,
                                    (formData.entity_id === null || formData.entity_id === '') && styles.companyOptionSelected
                                ]}
                                onPress={() => setFormData({ ...formData, entity_id: null })}
                            >
                                <Text style={[
                                    styles.companyText,
                                    (formData.entity_id === null || formData.entity_id === '') && styles.companyTextSelected
                                ]}>System (Global)</Text>
                            </TouchableOpacity>
                            {companies.map((c) => (
                                <TouchableOpacity
                                    key={c.id}
                                    style={[
                                        styles.companyOption,
                                        formData.entity_id === c.id && styles.companyOptionSelected
                                    ]}
                                    onPress={() => setFormData({ ...formData, entity_id: c.id })}
                                >
                                    <Text style={[
                                        styles.companyText,
                                        formData.entity_id === c.id && styles.companyTextSelected
                                    ]}>{c.name}</Text>
                                    <Text style={styles.companyCode}>{c.code}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                <AppButton
                    title={editUser ? "Update User Account" : "Create User Account"}
                    onPress={handleSubmit}
                    loading={loading}
                    style={styles.submitBtn}
                />

                {editUser && (
                    <View style={styles.auditContainer}>
                        <Text style={styles.auditText}>
                            Created: {editUser.createdAt ? new Date(editUser.createdAt).toLocaleString() : 'N/A'} {editUser.Creator ? `by ${editUser.Creator.name}` : ''}
                        </Text>
                        {(editUser.updatedAt && String(editUser.updatedAt) !== String(editUser.createdAt)) && (
                            <Text style={styles.auditText}>
                                Last Updated: {new Date(editUser.updatedAt).toLocaleString()} {editUser.Updater ? `by ${editUser.Updater.name}` : ''}
                            </Text>
                        )}
                    </View>
                )}
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
    label: {
        fontSize: normalize(14),
        fontWeight: '700',
        color: Colors.textLight,
        marginBottom: 8,
        marginTop: 16,
    },
    roleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    roleOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    roleOptionSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    roleOptionText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text,
    },
    roleOptionTextSelected: {
        color: Colors.white,
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 8,
    },
    selectedAdminText: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '600',
    },
    dropdownContent: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        marginBottom: 16,
    },
    adminItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    adminItemSelected: {
        backgroundColor: Colors.primary + '05',
    },
    adminItemInfo: {
        flex: 1,
    },
    adminName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    adminNameSelected: {
        color: Colors.primary,
    },
    adminEmail: {
        fontSize: 11,
        color: Colors.textLight,
        marginTop: 2,
    },
    emptyDropdown: {
        padding: 20,
        alignItems: 'center',
    },
    companyGrid: {
        gap: 8,
        marginBottom: 16,
    },
    companyOption: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    companyOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '05',
    },
    companyText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    companyTextSelected: {
        color: Colors.primary,
    },
    companyCode: {
        fontSize: 10,
        color: Colors.textLight,
    },
    submitBtn: { marginTop: 32, marginBottom: 20 },
    auditContainer: {
        marginTop: 10,
        padding: 15,
        backgroundColor: Colors.white,
        borderRadius: 12,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
    },
    auditText: {
        fontSize: 10,
        color: Colors.textLight,
        textAlign: 'center',
        lineHeight: 16,
    },
    emptyMsg: { color: Colors.danger, fontSize: 11, fontStyle: 'italic', textAlign: 'center' },
    roleBadge: {
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: 'hidden'
    }
});

export default AddUserScreen;
