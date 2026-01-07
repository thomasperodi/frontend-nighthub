import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useRef, useState, useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  withSpring,
  withTiming,
  Extrapolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  visualType: "circle" | "square" | "waves" | "stars";
  gradient: string[];
}

const onboardingData: OnboardingSlide[] = [
  {
    id: "1",
    title: "Benvenuto",
    subtitle: "Gestisci la notte come un professionista",
    description: "L'app che ti aiuta a organizzare ingressi, tavoli e serate. Tutto in un solo posto, sempre a portata di mano.",
    visualType: "circle",
    gradient: ["#9B5CFF", "#6B2DD9"],
  },
  {
    id: "2",
    title: "Organizza tutto",
    subtitle: "Ingressi e promozioni in tempo reale",
    description: "Controlla le liste, gestisci i biglietti e crea promozioni in tempo reale. Ogni ospite conta.",
    visualType: "square",
    gradient: ["#8B4DFF", "#6B2DD9"],
  },
  {
    id: "3",
    title: "Pianifica le serate",
    subtitle: "Tavoli e prenotazioni sempre sotto controllo",
    description: "Assegna tavoli, monitora le prenotazioni e ottimizza ogni spazio per rendere ogni serata un successo.",
    visualType: "waves",
    gradient: ["#7B3DFF", "#4B1D9C"],
  },
  {
    id: "4",
    title: "Inizia subito",
    subtitle: "Tutto è pronto",
    description: "Crea il tuo account e inizia a gestire le tue serate in modo semplice e professionale.",
    visualType: "stars",
    gradient: ["#9B5CFF", "#8B4DFF"],
  },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

const VisualPlaceholder = ({
  type,
  animatedScale,
  animatedRotate,
}: {
  type: OnboardingSlide["visualType"];
  animatedScale: any;
  animatedRotate: any;
}) => {

  const renderVisual = () => {
    switch (type) {
      case "circle":
        return (
          <View style={styles.visualContainer}>
            <LinearGradient
              colors={["#9B5CFF", "#6B2DD9", "#4B1D9C"]}
              style={styles.circleVisual}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.circleInner} />
            </LinearGradient>
          </View>
        );
      case "square":
        return (
          <View style={styles.visualContainer}>
            <LinearGradient
              colors={["#8B4DFF", "#6B2DD9"]}
              style={styles.squareVisual}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.squareInner} />
            </LinearGradient>
          </View>
        );
      case "waves":
        return (
          <View style={styles.visualContainer}>
            <View style={styles.wavesContainer}>
              <LinearGradient
                colors={["#7B3DFF", "#4B1D9C"]}
                style={[styles.wave, styles.wave1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <LinearGradient
                colors={["#8B4DFF", "#5B2DD9"]}
                style={[styles.wave, styles.wave2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <LinearGradient
                colors={["#9B5CFF", "#6B2DD9"]}
                style={[styles.wave, styles.wave3]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </View>
          </View>
        );
      case "stars":
        return (
          <View style={styles.visualContainer}>
            <View style={styles.starsContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.star,
                    {
                      top: `${20 + i * 15}%`,
                      left: `${15 + i * 20}%`,
                      transform: [{ rotate: `${i * 36}deg` }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["#9B5CFF", "#8B4DFF"]}
                    style={styles.starGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </View>
              ))}
            </View>
          </View>
        );
    }
  };

  return <View style={styles.visualWrapper}>{renderVisual()}</View>;
};

export default function OnboardingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeIn = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 600 });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => {
    const maxScroll = SCREEN_WIDTH * (onboardingData.length - 1);
    const progress = (scrollX.value / maxScroll) * 100;
    return {
      width: `${Math.min(100, Math.max(0, progress))}%`,
    };
  });

  const goToNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Login");
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
      setCurrentIndex(prevIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const skipOnboarding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Login");
  };

  const SlideItem = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const contentAnimatedStyle = useAnimatedStyle(() => {
      const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolate.CLAMP);
      const scale = interpolate(scrollX.value, inputRange, [0.9, 1, 0.9], Extrapolate.CLAMP);
      const translateY = interpolate(scrollX.value, inputRange, [30, 0, 30], Extrapolate.CLAMP);

      return {
        opacity: withTiming(opacity, { duration: 200 }),
        transform: [
          { scale: withSpring(scale, { damping: 15 }) },
          { translateY: withSpring(translateY, { damping: 15 }) },
        ],
      };
    });

    const visualAnimatedScale = useSharedValue(1);
    const visualAnimatedRotate = useSharedValue(0);

    const visualScaleStyle = useAnimatedStyle(() => {
      const scrollScale = interpolate(scrollX.value, inputRange, [0.8, 1, 0.8], Extrapolate.CLAMP);
      return {
        transform: [{ scale: withSpring(scrollScale * visualAnimatedScale.value, { damping: 12 }) }],
      };
    });

    const visualRotateStyle = useAnimatedStyle(() => {
      const scrollRotate = interpolate(scrollX.value, inputRange, [-15, 0, 15], Extrapolate.CLAMP);
      return {
        transform: [{ rotate: `${withSpring(scrollRotate + visualAnimatedRotate.value, { damping: 12 })}deg` }],
      };
    });

    useEffect(() => {
      if (index === currentIndex) {
        visualAnimatedScale.value = withSpring(1.05, { damping: 8 }, () => {
          visualAnimatedScale.value = withSpring(1, { damping: 8 });
        });
        visualAnimatedRotate.value = withSpring(3, { damping: 10 }, () => {
          visualAnimatedRotate.value = withSpring(0, { damping: 10 });
        });
      }
    }, [currentIndex, index]);

    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <Animated.View style={[styles.content, contentAnimatedStyle]}>
          <Animated.View style={[styles.visualWrapper, visualScaleStyle]}>
            <Animated.View style={visualRotateStyle}>
              <VisualPlaceholder
                type={item.visualType}
                animatedScale={visualAnimatedScale}
                animatedRotate={visualAnimatedRotate}
              />
            </Animated.View>
          </Animated.View>

          <Text style={styles.title} accessible={true} accessibilityRole="header">
            {item.title}
          </Text>
          <Text style={styles.subtitle} accessible={true}>
            {item.subtitle}
          </Text>
          <Text style={styles.description} accessible={true}>
            {item.description}
          </Text>
        </Animated.View>
      </View>
    );
  };

  const PaginationDot = ({ index }: { index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const dotStyle = useAnimatedStyle(() => {
      const scale = interpolate(scrollX.value, inputRange, [0.8, 1.2, 0.8], Extrapolate.CLAMP);
      const opacity = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolate.CLAMP);

      return {
        transform: [{ scale: withSpring(scale, { damping: 15 }) }],
        opacity: withTiming(opacity, { duration: 200 }),
      };
    });

    return (
      <Animated.View
        style={[
          styles.dot,
          currentIndex === index && styles.dotActive,
          dotStyle,
        ]}
      />
    );
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    return <SlideItem item={item} index={index} />;
  };

  return (
    <GradientBackground>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
          containerStyle,
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={skipOnboarding}
            style={styles.skipButton}
            activeOpacity={0.7}
            accessible={true}
            accessibilityLabel="Salta onboarding"
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Salta</Text>
          </TouchableOpacity>
        </View>

        <AnimatedFlatList
          ref={flatListRef}
          data={onboardingData}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            if (index !== currentIndex) {
              setCurrentIndex(index);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        <View style={styles.paginationContainer}>
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, progressBarStyle]} />
          </View>
          <View style={styles.pagination}>
            {onboardingData.map((_, index) => (
              <PaginationDot key={index} index={index} />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={goToPrevious}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Pagina precedente"
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Indietro</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.primaryButtonContainer, currentIndex === 0 && styles.primaryButtonFull]}>
            <PrimaryButton
              title={currentIndex === onboardingData.length - 1 ? "Inizia" : "Avanti"}
              onPress={goToNext}
            />
          </View>
        </View>
      </Animated.View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: "flex-end",
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: "#E0D7FF",
    fontSize: 16,
    fontWeight: "500",
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  visualWrapper: {
    width: 200,
    height: 200,
    marginBottom: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  visualContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  circleVisual: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  circleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  squareVisual: {
    width: 160,
    height: 160,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  squareInner: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  wavesContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  wave: {
    position: "absolute",
    borderRadius: 50,
  },
  wave1: {
    width: 180,
    height: 180,
    opacity: 0.6,
  },
  wave2: {
    width: 140,
    height: 140,
    opacity: 0.7,
    top: 10,
    left: 10,
  },
  wave3: {
    width: 100,
    height: 100,
    opacity: 0.8,
    top: 20,
    left: 20,
  },
  starsContainer: {
    width: 200,
    height: 200,
    position: "relative",
  },
  star: {
    position: "absolute",
    width: 40,
    height: 40,
  },
  starGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#B8A5FF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    color: "#E0D7FF",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 8,
    opacity: 0.95,
  },
  paginationContainer: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    minWidth: 100,
  },
  secondaryButtonText: {
    color: "#E0D7FF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  primaryButtonContainer: {
    flex: 1,
  },
  primaryButtonFull: {
    flex: 0,
    width: "100%",
  },
});
