import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Colors } from '../theme/Colors';
import { moderateScale, normalize } from '../theme/Scaling';

const OfflineBanner = () => {
    const [isConnected, setIsConnected] = useState(true);
    const animation = useState(new Animated.Value(-100))[0];

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);

            Animated.timing(animation, {
                toValue: state.isConnected ? -100 : 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        });

        return () => unsubscribe();
    }, []);

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: animation }] }]}>
            <View style={styles.banner}>
                <Text style={styles.text}>No Internet Connection</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
    },
    banner: {
        backgroundColor: Colors.danger,
        height: moderateScale(100),
        justifyContent: 'flex-end',
        paddingBottom: moderateScale(10),
        alignItems: 'center',
    },
    text: {
        color: Colors.white,
        fontSize: normalize(14),
        fontWeight: 'bold',
    },
});

export default OfflineBanner;
