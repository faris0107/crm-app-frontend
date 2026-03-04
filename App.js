import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PeopleListScreen from './src/screens/PeopleListScreen';
import PersonDetailScreen from './src/screens/PersonDetailScreen';
import AddUpdatePersonScreen from './src/screens/AddUpdatePersonScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OfflineBanner from './src/components/OfflineBanner';
import ErrorScreen from './src/screens/ErrorScreen';
import CompanyListScreen from './src/screens/CompanyListScreen';
import AddCompanyScreen from './src/screens/AddCompanyScreen';
import EditCompanyScreen from './src/screens/EditCompanyScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import ManageStatusScreen from './src/screens/ManageStatusScreen';
import AddEditStatusScreen from './src/screens/AddEditStatusScreen';
import UserListScreen from './src/screens/UserListScreen';
import AddUserScreen from './src/screens/AddUserScreen';
import UserDetailScreen from './src/screens/UserDetailScreen';

import RestoreUserScreen from './src/screens/RestoreUserScreen';

const Stack = createStackNavigator();

import { navigationRef } from './src/navigation/RootNavigation';

import BootSplash from "react-native-bootsplash";

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const App = () => {
    const [initialRoute, setInitialRoute] = React.useState(null);

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check Secure Storage for token
                const credentials = await Keychain.getGenericPassword({ service: 'accessToken' });
                const token = credentials ? credentials.password : null;
                const user = await AsyncStorage.getItem('user');

                if (token && user) {
                    setInitialRoute('Dashboard');
                } else {
                    setInitialRoute('Login');
                }
            } catch (error) {
                setInitialRoute('Login');
            }
        };
        checkAuth();
    }, []);

    if (!initialRoute) return null; // Wait for auth check
    return (
        <NavigationContainer
            ref={navigationRef}
            onReady={() => {
                BootSplash.hide({ fade: true });
            }}
        >
            <OfflineBanner />
            <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="PeopleList" component={PeopleListScreen} />
                <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
                <Stack.Screen name="AddUpdatePerson" component={AddUpdatePersonScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Error" component={ErrorScreen} />
                <Stack.Screen name="CompanyList" component={CompanyListScreen} />
                <Stack.Screen name="AddCompany" component={AddCompanyScreen} />
                <Stack.Screen name="EditCompany" component={EditCompanyScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                <Stack.Screen name="ManageStatus" component={ManageStatusScreen} />
                <Stack.Screen name="AddEditStatus" component={AddEditStatusScreen} />
                <Stack.Screen name="UserList" component={UserListScreen} />
                <Stack.Screen name="AddUser" component={AddUserScreen} />
                <Stack.Screen name="UserDetail" component={UserDetailScreen} />
                <Stack.Screen name="RestoreUser" component={RestoreUserScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default App;
