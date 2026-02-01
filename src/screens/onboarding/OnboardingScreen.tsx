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
import { useTheme } from "../../theme/ThemeProvider"; 
import { setOnboardingSeen } from "../../services/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon?: string;
}

const onboardingData: OnboardingSlide[] = [
  {
    id: "1",
    title: "La serata inizia prima",
    subtitle: "Tutto chiaro, fin dall’inizio",
    description:
      "Scopri serate, orari e vantaggi disponibili prima di arrivare, senza caos o incertezze."
  },
  {
    id: "2",
    title: "Muoviti con il tuo gruppo",
    subtitle: "Organizzati in pochi secondi",
    description:
      "Crea gruppi, prenota tavoli e vivi la serata insieme, senza perdere tempo o persone.",
    
  },
  {
    id: "3",
    title: "Vantaggi reali",
    subtitle: "Niente promesse a vuoto",
    description:
      "Promo chiare, ingressi agevolati e benefici concreti, validi solo quando contano davvero.",
    
  },
  {
    id: "4",
    title: "La notte, fatta bene",
    subtitle: "Meno stress. Più esperienza.",
    description:
      "Accedi e inizia a vivere la serata nel modo giusto.",
    
  },
];

const AnimatedFlatList =
  Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

const IconVisual = ({ icon }: { icon: string }) => (
  <View style={styles.iconContainer}>
    <LinearGradient
      colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.05)"]}
      style={styles.iconBackground}
    >
      <Text style={styles.iconText}>{icon}</Text>
    </LinearGradient>
  </View>
);

export default function OnboardingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // Mark as seen as soon as user opens onboarding at least once.
    (async () => {
      try {
        await setOnboardingSeen(true);
      } catch {
        // ignore storage errors
      }
    })();
  }, []);

  const completeOnboarding = async () => {
    navigation.replace("Login");
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const goNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      completeOnboarding();
    }
  };

  const goPrev = () => {
    flatListRef.current?.scrollToIndex({
      index: currentIndex - 1,
      animated: true,
    });
    setCurrentIndex(currentIndex - 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const Slide = ({ item, index }: any) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const style = useAnimatedStyle(() => ({
      opacity: interpolate(scrollX.value, inputRange, [0.3, 1, 0.3]),
      transform: [
        {
          scale: withSpring(
            interpolate(scrollX.value, inputRange, [0.95, 1, 0.95]),
            { damping: 18 }
          ),
        },
      ],
    }));

    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <Animated.View style={[styles.content, style]}>
          {/* <IconVisual icon={item.icon} /> */}
          <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{item.subtitle}</Text>
          <Text style={[styles.description, { color: theme.colors.muted }]}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <GradientBackground>
      <StatusBar barStyle="light-content" />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={completeOnboarding}>
            <Text style={[styles.skipText, { color: theme.colors.muted }]}>Salta</Text>
          </TouchableOpacity>
        </View>

        {/* SLIDES */}
        <View style={styles.slidesWrapper}>
          <AnimatedFlatList
            ref={flatListRef}
            data={onboardingData}
            renderItem={({ item, index }) => (
              <Slide item={item} index={index} />
            )}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) =>
              setCurrentIndex(
                Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
              )
            }
            keyExtractor={(item) => item.id}
          />
        </View>

        {/* BOTTOM AREA (FIXED) */}
        <View
          style={[
            styles.bottomArea,
            { paddingBottom: insets.bottom + 16 },
          ]}
        >
          {/* PAGINATION */}
          <View style={styles.pagination}>
            {onboardingData.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: currentIndex === i ? theme.colors.primary : theme.colors.border },
                ]}
              />
            ))}
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                onPress={goPrev}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Indietro</Text>
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }}>
              <PrimaryButton
                title={
                  currentIndex === onboardingData.length - 1
                    ? "Inizia"
                    : "Avanti"
                }
                onPress={goNext}
              />
            </View>
          </View>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    alignItems: "flex-end",
  },

  skipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
  },

  slidesWrapper: {
    flex: 1,
  },

  slide: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },

  content: {
    alignItems: "center",
    maxWidth: 380,
  },

  iconContainer: {
    marginBottom: 32,
  },

  iconBackground: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
  },

  iconText: {
    fontSize: 64,
  },

  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },

  subtitle: {
    color: "#C4B5FD",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },

  description: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },

  bottomArea: {
    paddingHorizontal: 32,
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
    gap: 8,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  dotActive: {
    backgroundColor: "#fff",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
