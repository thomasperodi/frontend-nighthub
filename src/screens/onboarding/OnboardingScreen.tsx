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
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/ThemeProvider"; 
import { setOnboardingSeen } from "../../services/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  effortHint: string;
}

const onboardingData: OnboardingSlide[] = [
  {
    id: "1",
    kicker: "A cosa serve",
    title: "Decidi la serata in 30 secondi",
    subtitle: "Tutto chiaro prima di uscire",
    description:
      "NightHub ti aiuta a vedere eventi, orari e vantaggi reali in un unico posto, senza perdere tempo tra chat e storie.",
    highlights: [
      "Eventi e promo aggiornati in tempo reale",
      "Info pratiche subito visibili",
      "Meno caos, più controllo",
    ],
    effortHint: "Setup iniziale: meno di 1 minuto",
  },
  {
    id: "2",
    kicker: "Quanto è facile",
    title: "3 tocchi e sei pronto",
    subtitle: "Flusso semplice, nessuna frizione",
    description:
      "Scegli il locale, prenota e condividi con il gruppo. Nessuna configurazione complessa, solo azioni veloci.",
    highlights: [
      "1) Scegli evento o promo",
      "2) Prenota ingresso o tavolo",
      "3) Invita il tuo gruppo",
    ],
    effortHint: "Curva di apprendimento: praticamente zero",
  },
  {
    id: "3",
    kicker: "Perché conviene",
    title: "Vantaggi concreti, quando servono",
    subtitle: "Niente promesse vaghe",
    description:
      "Visualizzi solo benefit utili e validi: ingressi agevolati, promo attive e dettagli trasparenti.",
    highlights: [
      "Condizioni chiare prima di prenotare",
      "Risparmio di tempo all’ingresso",
      "Esperienza più fluida per tutto il gruppo",
    ],
    effortHint: "Risultato: più esperienza, meno attese",
  },
  {
    id: "4",
    kicker: "Partenza rapida",
    title: "Sei pronto a iniziare",
    subtitle: "Meno stress, più serata",
    description:
      "Accedi ora e usa NightHub da subito. Tutto è pensato per farti arrivare al punto in pochi passaggi.",
    highlights: [
      "Interfaccia intuitiva",
      "Prenotazione rapida",
      "Gestione semplice delle uscite",
    ],
    effortHint: "Tempo medio per iniziare: ~45 secondi",
  },
];

const AnimatedFlatList =
  Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

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
    if (typeof navigation?.canGoBack === "function" && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

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
          <View style={[styles.kickerPill, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
            <Text style={[styles.kickerText, { color: theme.colors.primary }]}>{item.kicker}</Text>
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{item.subtitle}</Text>
          <Text style={[styles.description, { color: theme.colors.muted }]}>{item.description}</Text>

          <View style={[styles.highlightsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            {item.highlights.map((highlight: string, idx: number) => (
              <View key={`${item.id}-${idx}`} style={styles.highlightRow}>
                <View style={[styles.checkBadge, { backgroundColor: theme.colors.primary + "22" }]}> 
                  <Feather name="check" size={12} color={theme.colors.primary} />
                </View>
                <Text style={[styles.highlightText, { color: theme.colors.text }]}>{highlight}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.effortPill, { borderColor: theme.colors.border }]}> 
            <Feather name="zap" size={14} color={theme.colors.primary} />
            <Text style={[styles.effortText, { color: theme.colors.muted }]}>{item.effortHint}</Text>
          </View>
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
          <View style={[styles.topBadge, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
            <Feather name="clock" size={12} color={theme.colors.primary} />
            <Text style={[styles.topBadgeText, { color: theme.colors.muted }]}>Guida rapida · 1 minuto</Text>
          </View>

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
                  {
                    backgroundColor: currentIndex === i ? theme.colors.primary : theme.colors.border,
                    width: currentIndex === i ? 20 : 8,
                  },
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
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  topBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  skipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "600",
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
    alignItems: "flex-start",
    maxWidth: 380,
    width: "100%",
  },

  kickerPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 16,
  },

  kickerText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  title: {
    color: "#fff",
    fontSize: 31,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "left",
  },

  subtitle: {
    color: "#C4B5FD",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 14,
    textAlign: "left",
  },

  description: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "left",
    marginBottom: 16,
  },

  highlightsCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },

  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  highlightText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },

  effortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  effortText: {
    fontSize: 12,
    fontWeight: "600",
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
