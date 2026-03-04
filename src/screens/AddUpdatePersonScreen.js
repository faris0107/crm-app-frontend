import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/Colors';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';
import { normalize } from '../theme/Scaling';
import AppConfirmModal from '../components/AppConfirmModal';

const AddUpdatePersonScreen = ({ route, navigation }) => {
    const person = route.params?.person;
    const parentStaff = route.params?.parentStaff;
    const isEdit = !!person;

    const [currentUser, setCurrentUser] = useState(null);
    const [form, setForm] = useState({
        name: person?.name || '',
        text_id: person?.text_id || '',
        mobile: person?.mobile || '',
        status_id: person?.status_id || '',
        tags: Array.isArray(person?.tags) ? person.tags.join(', ') : (typeof person?.tags === 'string' ? person.tags : ''),
        assigned_to: person?.assigned_to || parentStaff?.id || '',
        referred_by: person?.referred_by || '',
    });

    const [statuses, setStatuses] = useState([]);
    const [allAdmins, setAllAdmins] = useState([]);
    const [allL1, setAllL1] = useState([]);
    const [allL2, setAllL2] = useState([]);
    const [selectedAdminId, setSelectedAdminId] = useState(null);
    const [selectedL1Id, setSelectedL1Id] = useState(null);
    const [dropdowns, setDropdowns] = useState({ status: false, admin: false, l1: false, l2: false });
    const [loading, setLoading] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const userDataString = await AsyncStorage.getItem('user');
            let effectiveEntityId = null;

            if (userDataString) {
                const parsed = JSON.parse(userDataString);
                setCurrentUser(parsed);
                effectiveEntityId = parsed.entity_id;

                if (!effectiveEntityId) {
                    effectiveEntityId = await AsyncStorage.getItem('activeCompanyId');
                }

                if (!isEdit && parsed.role === 'L2') {
                    setForm(prev => ({ ...prev, assigned_to: parsed.id }));
                }
            }

            const [sRes, uRes] = await Promise.all([
                apiClient.get('/statuses'),
                apiClient.get(`/users?entity_id=${effectiveEntityId || ''}`)
            ]);
            setStatuses(sRes.data);

            const admins = uRes.data.filter(u => u.Role?.name === 'ADMIN');
            const l1 = uRes.data.filter(u => u.Role?.name === 'L1');
            const l2 = uRes.data.filter(u => u.Role?.name === 'L2');

            setAllAdmins(admins);
            setAllL1(l1);
            setAllL2(l2);

            if (parentStaff) {
                // If we came from a specific L2 drill-down
                const l2Obj = l2.find(u => u.id === parentStaff.id);
                if (l2Obj) {
                    const l1Obj = l1.find(u => u.id === l2Obj.parent_id);
                    if (l1Obj) setSelectedAdminId(l1Obj.parent_id);
                    setSelectedL1Id(l2Obj.parent_id);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSave = async () => {
        if (!form.name || !form.text_id) {
            setModalConfig({
                visible: true,
                title: 'Missing Details',
                message: 'Name and Contact ID are required fields.',
                confirmText: 'OK',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        setModalConfig({
            visible: true,
            title: isEdit ? 'Update Contact' : 'Create Contact',
            message: isEdit ? 'Save changes to this contact?' : 'Add this new contact to the system?',
            confirmText: isEdit ? 'Save' : 'Create',
            type: 'default',
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                setLoading(true);
                try {
                    const payload = {
                        ...form,
                        tags: form.tags.split(',').map(t => t.trim()).filter(t => t),
                        status_id: form.status_id || null,
                        assigned_to: form.assigned_to || null,
                        referred_by: form.referred_by || null,
                    };

                    if (isEdit) {
                        await apiClient.put(`/people/${person.id}`, payload);
                    } else {
                        await apiClient.post('/people', payload);
                    }

                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: `Contact ${isEdit ? 'updated' : 'created'} successfully`,
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
                        message: error.response?.data?.message || 'Failed to save',
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

    const isSuperAdmin = !currentUser?.entity_id;
    const isAdmin = currentUser?.role === 'ADMIN';
    const isL1 = currentUser?.role === 'L1';
    const isL2 = currentUser?.role === 'L2';

    const toggleDropdown = (key) => {
        setDropdowns(prev => ({
            status: key === 'status' ? !prev.status : false,
            admin: key === 'admin' ? !prev.admin : false,
            l1: key === 'l1' ? !prev.l1 : false,
            l2: key === 'l2' ? !prev.l2 : false,
        }));
    };

    const renderAssignmentHierarchy = () => {
        if (isL2) {
            return (
                <View style={styles.infoBox}>
                    <Icon name="info" size={16} color={Colors.primary} />
                    <Text style={styles.infoText}>Assigned to: {currentUser.name} (Yourself)</Text>
                </View>
            );
        }

        const currentAdminId = isAdmin ? currentUser.id : selectedAdminId;
        const currentL1Id = isL1 ? currentUser.id : selectedL1Id;

        const filteredL1 = allL1.filter(l1 => l1.parent_id === currentAdminId);
        const filteredL2 = allL2.filter(l2 => l2.parent_id === currentL1Id);

        return (
            <>
                {/* 1. Admin Select (Only for SuperAdmin) */}
                {!isAdmin && !isL1 && (
                    <>
                        <Text style={styles.label}>Select Admin *</Text>
                        <TouchableOpacity style={styles.dropdown} onPress={() => toggleDropdown('admin')}>
                            <Text style={styles.dropdownValue}>
                                {selectedAdminId ? allAdmins.find(a => a.id === selectedAdminId)?.name : 'Choose Admin'}
                            </Text>
                            <Icon name={dropdowns.admin ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
                        </TouchableOpacity>
                        {dropdowns.admin && (
                            <View style={styles.dropdownContent}>
                                {allAdmins.map(a => (
                                    <TouchableOpacity
                                        key={a.id}
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            setSelectedAdminId(a.id);
                                            setSelectedL1Id(null);
                                            setForm(prev => ({ ...prev, assigned_to: '' }));
                                            toggleDropdown(null);
                                        }}
                                    >
                                        <Text style={styles.itemText}>{a.name}</Text>
                                        {selectedAdminId === a.id && <Icon name="check" size={16} color={Colors.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                )}

                {/* 2. L1 Manager Select */}
                {!isL1 && (
                    <>
                        <Text style={styles.label}>Select L1 Manager *</Text>
                        <TouchableOpacity
                            style={[styles.dropdown, !currentAdminId && { backgroundColor: Colors.border + '30' }]}
                            onPress={() => currentAdminId && toggleDropdown('l1')}
                            disabled={!currentAdminId}
                        >
                            <Text style={[styles.dropdownValue, !currentAdminId && { color: Colors.textLight }]}>
                                {selectedL1Id ? allL1.find(l => l.id === selectedL1Id)?.name : (currentAdminId ? 'Choose L1' : 'Select Admin First')}
                            </Text>
                            <Icon name={dropdowns.l1 ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
                        </TouchableOpacity>
                        {dropdowns.l1 && (
                            <View style={styles.dropdownContent}>
                                {filteredL1.length > 0 ? filteredL1.map(l => (
                                    <TouchableOpacity
                                        key={l.id}
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            setSelectedL1Id(l.id);
                                            setForm(prev => ({ ...prev, assigned_to: '' }));
                                            toggleDropdown(null);
                                        }}
                                    >
                                        <Text style={styles.itemText}>{l.name}</Text>
                                        {selectedL1Id === l.id && <Icon name="check" size={16} color={Colors.primary} />}
                                    </TouchableOpacity>
                                )) : (
                                    <View style={styles.emptyItem}><Text style={styles.emptyText}>No L1 Managers found</Text></View>
                                )}
                            </View>
                        )}
                    </>
                )}

                {/* 3. L2 Supervisor Select */}
                <Text style={styles.label}>Select L2 Supervisor *</Text>
                <TouchableOpacity
                    style={[styles.dropdown, !currentL1Id && { backgroundColor: Colors.border + '30' }]}
                    onPress={() => currentL1Id && toggleDropdown('l2')}
                    disabled={!currentL1Id}
                >
                    <Text style={[styles.dropdownValue, !currentL1Id && { color: Colors.textLight }]}>
                        {form.assigned_to ? allL2.find(l => l.id === form.assigned_to)?.name : (currentL1Id ? 'Choose L2' : 'Select L1 First')}
                    </Text>
                    <Icon name={dropdowns.l2 ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
                </TouchableOpacity>
                {dropdowns.l2 && (
                    <View style={styles.dropdownContent}>
                        {filteredL2.length > 0 ? filteredL2.map(l => (
                            <TouchableOpacity
                                key={l.id}
                                style={styles.dropdownItem}
                                onPress={() => {
                                    setForm(prev => ({ ...prev, assigned_to: l.id }));
                                    toggleDropdown(null);
                                }}
                            >
                                <Text style={styles.itemText}>{l.name}</Text>
                                {form.assigned_to === l.id && <Icon name="check" size={16} color={Colors.primary} />}
                            </TouchableOpacity>
                        )) : (
                            <View style={styles.emptyItem}><Text style={styles.emptyText}>No L2 Supervisors found</Text></View>
                        )}
                    </View>
                )}
            </>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Icon name="x" size={24} color={Colors.danger} />
                </TouchableOpacity>
                <Text style={styles.title}>{isEdit ? 'Edit Contact' : 'New Contact'}</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.headerBtn}>
                    <Icon name="check" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <AppInput
                    label="Full Name *"
                    value={form.name}
                    onChangeText={(v) => setForm({ ...form, name: v })}
                    placeholder="Enter name"
                />
                <AppInput
                    label="Contact ID *"
                    value={form.text_id}
                    onChangeText={(v) => setForm({ ...form, text_id: v })}
                    placeholder="e.g. PERS001"
                />

                <Text style={styles.label}>Pipeline Status</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => toggleDropdown('status')}>
                    <Text style={styles.dropdownValue}>
                        {form.status_id ? statuses.find(s => s.id === form.status_id)?.name : 'Choose Status'}
                    </Text>
                    <Icon name={dropdowns.status ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
                </TouchableOpacity>
                {dropdowns.status && (
                    <View style={styles.dropdownContent}>
                        {statuses.map(s => (
                            <TouchableOpacity
                                key={s.id}
                                style={styles.dropdownItem}
                                onPress={() => {
                                    setForm(prev => ({ ...prev, status_id: s.id }));
                                    toggleDropdown(null);
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                                    <Text style={styles.itemText}>{s.name}</Text>
                                </View>
                                {form.status_id === s.id && <Icon name="check" size={16} color={Colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {renderAssignmentHierarchy()}

                <View style={styles.divider} />

                <AppInput
                    label="Mobile Number"
                    value={form.mobile}
                    onChangeText={(v) => setForm({ ...form, mobile: v })}
                    placeholder="+91 XXXXX XXXXX"
                    keyboardType="phone-pad"
                />
                <AppInput
                    label="Tags (comma separated)"
                    value={form.tags}
                    onChangeText={(v) => setForm({ ...form, tags: v })}
                    placeholder="tag1, tag2"
                />
                <AppInput
                    label="Referred By"
                    value={form.referred_by}
                    onChangeText={(v) => setForm({ ...form, referred_by: v })}
                    placeholder="Enter who referred this contact"
                />

                <AppButton
                    title={isEdit ? "Update Contact" : "Create Contact"}
                    onPress={handleSave}
                    loading={loading}
                    style={styles.saveBtn}
                />

                {isEdit && person && (
                    <View style={styles.auditContainer}>
                        <Text style={styles.auditText}>
                            Created: {person.createdAt ? new Date(person.createdAt).toLocaleString() : 'N/A'}
                            {person.Creator ? ` by ${person.Creator.name}` : ''}
                        </Text>
                        {(person.updatedAt && String(person.updatedAt) !== String(person.createdAt)) && (
                            <Text style={styles.auditText}>
                                Last Updated: {new Date(person.updatedAt).toLocaleString()}
                                {person.Updater ? ` by ${person.Updater.name}` : ''}
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
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: Colors.white,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
    },
    headerBtn: { padding: 4 },
    title: { fontSize: normalize(18), fontWeight: '700', color: Colors.text },
    content: { padding: 24 },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text,
        marginTop: 18,
        marginBottom: 12,
        marginLeft: 4,
    },
    toggleRow: {
        flexDirection: 'row',
        backgroundColor: Colors.border + '50',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    toggleBtnActive: {
        backgroundColor: Colors.white,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textLight,
    },
    toggleTextActive: {
        color: Colors.primary,
    },
    dropdown: {
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
    dropdownValue: {
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
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    itemText: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    emptyItem: {
        padding: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 12,
        color: Colors.danger,
        fontStyle: 'italic',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        padding: 12,
        borderRadius: 12,
        marginTop: 10,
    },
    infoText: {
        marginLeft: 8,
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 24,
        opacity: 0.5,
    },
    saveBtn: { marginTop: 20, marginBottom: 20 },
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
});

export default AddUpdatePersonScreen;
