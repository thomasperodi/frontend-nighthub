import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { fetchAdminProfile, logoutAdmin } from "../../../services/admin";
import { AdminProfile } from "../../../types/admin";

interface AdminProfileTabProps {
  onLogout: () => void;
}

export default function AdminProfileTab({ onLogout }: AdminProfileTabProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchAdminProfile();
        if (!isMounted) return;
        setProfile(data);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // ignore network errors
    } finally {
      onLogout();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profilo Admin</Text>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Caricamento profilo...</Text>
          </View>
        )}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Feather name="user" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.name ?? ""}</Text>
              <Text style={styles.profileMeta}>{profile?.email ?? ""}</Text>
              <Text style={styles.profileRole}>{profile?.role ?? ""}</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.profileAction}
              onPress={() => Alert.alert("Profilo", "Modifica dati profilo")}
            >
              <Feather name="edit" size={16} color={theme.colors.text} />
              <Text style={styles.profileActionText}>Modifica profilo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileAction}
              onPress={() => Alert.alert("Sicurezza", "Cambio password")}
            >
              <Feather name="lock" size={16} color={theme.colors.text} />
              <Text style={styles.profileActionText}>Cambia password</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={18} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 140,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  profileCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 16,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + "22",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    gap: 4,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },
  profileMeta: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  profileRole: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  profileAction: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.error,
  },
  logoutText: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
});
