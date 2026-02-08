import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, FlatList, Alert, SectionList, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../theme/ThemeProvider";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  acceptFriendRequest,
  addFriendGroupMember,
  createFriendGroup,
  deleteFriendGroup,
  listFriendGroups,
  listFriendRequests,
  listFriends,
  removeFriend,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
} from "../../../services/friends";
// Mock data - Amici
const MOCK_FRIENDS = [
  {
    id: 1,
    name: "Marco Rossi",
    online: true,
    currentVenue: "Club Luna",
    status: "In un evento",
    avatar: "👨",
    lastSeen: null,
  },
  {
    id: 2,
    name: "Giulia Bianchi",
    online: true,
    currentVenue: "The Club",
    status: "Con amici",
    avatar: "👩",
    lastSeen: null,
  },
  {
    id: 3,
    name: "Alessandro Verdi",
    online: true,
    currentVenue: "Club Luna",
    status: "Sola/solo",
    avatar: "👨",
    lastSeen: null,
  },
  {
    id: 4,
    name: "Sofia Romano",
    online: false,
    currentVenue: null,
    status: null,
    avatar: "👩",
    lastSeen: "2 ore fa",
  },
  {
    id: 5,
    name: "Luca Ferrari",
    online: false,
    currentVenue: null,
    status: null,
    avatar: "👨",
    lastSeen: "1 giorno fa",
  },
];

type FriendItem = {
  id: string;
  name: string;
  online: boolean;
  currentVenue: string | null;
  status: string | null;
  avatar: string;
  lastSeen: string | null;
};

type FriendRequestItem = {
  id: string;
  name: string;
  avatar: string;
  sentAt: string;
};

type UserSearchItem = {
  id: string;
  name: string;
  avatar: string;
  isFriend: boolean;
  mutualFriendsIds: string[];
};

type GroupItem = {
  id: string;
  name: string;
  avatar: string;
  members: string[];
  color: string;
  createdAt: Date;
};

// Mock data - Persone da aggiungere
const MOCK_USERS_TO_ADD = [
  { id: 101, name: "Chiara Moretti", avatar: "👩", isFriend: false, mutualFriendsIds: [1, 4] },
  { id: 102, name: "Matteo De Luca", avatar: "👨", isFriend: false, mutualFriendsIds: [2, 5] },
  { id: 103, name: "Elena Costa", avatar: "👩", isFriend: false, mutualFriendsIds: [1, 2, 3] },
  { id: 104, name: "Davide Gallo", avatar: "👨", isFriend: false, mutualFriendsIds: [3] },
  { id: 105, name: "Francesca Rizzo", avatar: "👩", isFriend: false, mutualFriendsIds: [1, 2] },
];

// Mock data - Richieste di amicizia
const MOCK_FRIEND_REQUESTS = [
  { id: 201, name: "Valentina Russo", avatar: "👩", sentAt: "1 ora fa" },
  { id: 202, name: "Andrea Colombo", avatar: "👨", sentAt: "3 ore fa" },
];

// Mock data - Gruppi di amici
const MOCK_GROUPS = [
  {
    id: 1,
    name: "Crew Universitaria",
    avatar: "👥",
    members: [1, 2, 3],
    color: "#6D5BFF",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: 2,
    name: "Calcetto",
    avatar: "⚽",
    members: [1, 5],
    color: "#3B82F6",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
];

// Mock data - Locali disponibili
const MOCK_VENUES = [
  { id: 1, name: "Club Luna", avatar: "🌙", price: "€€" },
  { id: 2, name: "The Club", avatar: "🎉", price: "€€€" },
  { id: 3, name: "Paradise", avatar: "😎", price: "€" },
];

export default function FriendsTab() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const bottomActionOffset = Math.max(insets.bottom, 16) + 90;
  const [friends, setFriends] = useState<FriendItem[]>(
    MOCK_FRIENDS.map((f) => ({
      ...f,
      id: String(f.id),
    }))
  );
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>(
    MOCK_FRIEND_REQUESTS.map((r) => ({
      ...r,
      id: String(r.id),
    }))
  );
  const [usersToAdd, setUsersToAdd] = useState<UserSearchItem[]>(
    MOCK_USERS_TO_ADD.map((u) => ({
      ...u,
      id: String(u.id),
      mutualFriendsIds: (u.mutualFriendsIds || []).map((id) => String(id)),
    }))
  );
  const [groups, setGroups] = useState<GroupItem[]>(
    MOCK_GROUPS.map((g) => ({
      ...g,
      id: String(g.id),
      members: g.members.map((id) => String(id)),
    }))
  );
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends");
  const [searchText, setSearchText] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  const onlineFriends = friends.filter(f => f.online);
  const offlineFriends = friends.filter(f => !f.online);

  useEffect(() => {
    const loadAll = async () => {
      setLoadingFriends(true);
      setLoadingRequests(true);
      setLoadingGroups(true);

      try {
        const [friendsRes, requestsRes, groupsRes] = await Promise.all([
          listFriends(),
          listFriendRequests(),
          listFriendGroups(),
        ]);

        setFriends(
          friendsRes.map((f) => ({
            id: f.id,
            name: f.name || f.username || "Utente",
            online: false,
            currentVenue: null,
            status: null,
            avatar: f.avatar || "👤",
            lastSeen: "Ora",
          }))
        );

        setFriendRequests(
          requestsRes.incoming.map((req) => ({
            id: req.id,
            name: req.from_user.name || req.from_user.username || "Utente",
            avatar: req.from_user.avatar || "👤",
            sentAt: "Nuova",
          }))
        );

        setGroups(
          groupsRes.map((g) => ({
            id: g.id,
            name: g.name,
            avatar: "👥",
            members: g.members.map((m) => m.user.id),
            color: "#6D5BFF",
            createdAt: new Date(),
          }))
        );
      } catch {
        // fallback to mock data already in state
      } finally {
        setLoadingFriends(false);
        setLoadingRequests(false);
        setLoadingGroups(false);
      }
    };

    loadAll();
  }, []);

  useEffect(() => {
    const loadSearch = async () => {
      const q = searchText.trim();
      if (q.length < 2) return;
      setLoadingSearch(true);
      try {
        const results = await searchUsers(q);
        setUsersToAdd(
          results.map((u) => ({
            id: u.id,
            name: u.name || u.username || "Utente",
            avatar: u.avatar || "👤",
            isFriend: false,
            mutualFriendsIds: [],
          }))
        );
      } catch {
        // ignore search errors
      } finally {
        setLoadingSearch(false);
      }
    };

    loadSearch();
  }, [searchText]);

  const searchedUsers = useMemo(() => {
    return usersToAdd.filter(user =>
      user.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [searchText, usersToAdd]);

  const getMutualFriends = (userId: string) => {
    const user = usersToAdd.find(u => u.id === userId);
    if (!user) return [];
    return friends.filter(f => user.mutualFriendsIds?.includes(f.id));
  };

  const getGroupMembers = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    return friends.filter(f => group.members.includes(f.id));
  };

  const handleSendFriendRequest = async (userId: number | string, userName: string) => {
    try {
      await sendFriendRequest({ user_id: String(userId) });
      Alert.alert("Richiesta inviata", `Richiesta inviata a ${userName}!`, [
        {
          text: "OK",
          onPress: () => {
            setUsersToAdd(prev => prev.map(u => 
              u.id === userId ? { ...u, isFriend: true } : u
            ));
            setSelectedProfile(null);
          }
        }
      ]);
    } catch {
      Alert.alert("Errore", "Impossibile inviare la richiesta");
    }
  };

  const openFriendProfile = (friend: FriendItem) => {
    setSelectedProfile({
      id: friend.id,
      name: friend.name,
      avatar: friend.avatar,
      isFriend: true,
    });
  };

  const openRequestProfile = (request: FriendRequestItem) => {
    setSelectedProfile({
      id: request.id,
      name: request.name,
      avatar: request.avatar,
      isFriend: false,
      requestId: request.id,
    });
  };

  const handleAcceptFriendRequest = async (requestId: number | string, userName: string) => {
    try {
      await acceptFriendRequest(String(requestId));
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      setFriends(prev => [...prev, {
        id: String(requestId),
        name: userName,
        avatar: "👤",
        online: false,
        currentVenue: null,
        status: null,
        lastSeen: "Ora",
      }]);
      Alert.alert("✅ Amico aggiunto!", `${userName} è ora un tuo amico!`);
    } catch {
      Alert.alert("Errore", "Impossibile accettare la richiesta");
    }
  };

  const handleRejectFriendRequest = async (requestId: number | string, userName: string) => {
    try {
      await rejectFriendRequest(String(requestId));
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      Alert.alert("Richiesta rifiutata", `Hai rifiutato la richiesta di ${userName}`);
    } catch {
      Alert.alert("Errore", "Impossibile rifiutare la richiesta");
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedGroupMembers.length === 0) {
      Alert.alert("Errore", "Inserisci un nome e seleziona almeno un amico");
      return;
    }
    try {
      const created = await createFriendGroup({
        name: newGroupName,
        member_ids: selectedGroupMembers.map((id) => String(id)),
      });

      setGroups((prev) => [
        {
          id: created.id,
          name: created.name,
          avatar: "👥",
          members: created.members?.map((m: any) => m.user?.id) ?? [],
          color: "#6D5BFF",
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setNewGroupName("");
      setSelectedGroupMembers([]);
      setShowCreateGroupModal(false);
      Alert.alert("✅ Gruppo creato!", `"${newGroupName}" è stato creato!`);
    } catch {
      Alert.alert("Errore", "Impossibile creare il gruppo");
    }
  };

  const handleAddMemberToGroup = async (friendId: number | string, friendName: string) => {
    const memberId = String(friendId);
    if (selectedGroup.members.includes(memberId)) {
      Alert.alert("Avviso", `${friendName} è già nel gruppo`);
      return;
    }
    try {
      await addFriendGroupMember(String(selectedGroup.id), memberId);
      const updatedGroups = groups.map(g => 
        g.id === selectedGroup.id 
          ? { ...g, members: [...g.members, memberId] }
          : g
      );
      setGroups(updatedGroups);
      setSelectedGroup({ ...selectedGroup, members: [...selectedGroup.members, memberId] });
      Alert.alert("✅ Aggiunto!", `${friendName} è stato aggiunto al gruppo`);
    } catch {
      Alert.alert("Errore", "Impossibile aggiungere al gruppo");
    }
  };

  const renderFriendCard = ({ item, section }: any) => {
    if (section?.type === "requests") {
      return (
        <TouchableOpacity
          style={styles.requestCard}
          activeOpacity={0.8}
          onPress={() => openRequestProfile(item)}
        >
          <View style={styles.requestContent}>
            <Text style={styles.avatar}>{item.avatar}</Text>
            <View style={styles.requestInfo}>
              <Text style={styles.requestName}>{item.name}</Text>
              <Text style={styles.requestTime}>{item.sentAt}</Text>
            </View>
          </View>
          <View style={styles.requestActions}>
            <TouchableOpacity 
              style={[styles.actionButtonSmall, styles.acceptButton]}
              onPress={() => handleAcceptFriendRequest(item.id, item.name)}
            >
              <Feather name="check" size={18} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButtonSmall, styles.rejectButton]}
              onPress={() => handleRejectFriendRequest(item.id, item.name)}
            >
              <Feather name="x" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.friendCard, !section?.isOnline && styles.friendCardOffline]}
        activeOpacity={0.7}
        onPress={() => openFriendProfile(item)}
      >
        <View style={styles.friendContent}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{item.avatar}</Text>
            {item.online && <View style={styles.onlineBadge} />}
          </View>

          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{item.name}</Text>
            {item.online ? (
              <View style={styles.statusRow}>
                <Feather name="map-pin" size={13} color={theme.colors.primary} />
                <Text style={styles.venueText} numberOfLines={1}>{item.currentVenue}</Text>
              </View>
            ) : (
              <Text style={styles.offlineText}>Visto {item.lastSeen}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section?.type === "friends" && (
        <View style={[styles.sectionDot, section.isOnline ? styles.dotOnline : styles.dotOffline]} />
      )}
      {section?.type === "requests" && (
        <View style={[styles.sectionDot, styles.dotRequest]} />
      )}
    </View>
  );

  const renderGroupCard = ({ item }: any) => (
    
    <TouchableOpacity 
      style={[styles.groupCard, { borderColor: item.color }]}
      onPress={() => setSelectedGroup(item)}
    >
      <View style={[styles.groupIconContainer, { backgroundColor: item.color + "20" }]}>
        <Text style={styles.groupIcon}>{item.avatar}</Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMembers}>{item.members.length} membri</Text>
      </View>
      <Feather name="chevron-right" size={20} color={theme.colors.muted} />
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.searchResultCard}
      onPress={() => setSelectedProfile(item)}
    >
      <View style={styles.searchResultContent}>
        <Text style={styles.avatar}>{item.avatar}</Text>
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          <Text style={styles.mutualCount}>
            {getMutualFriends(item.id).length} amici in comune
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={theme.colors.muted} />
    </TouchableOpacity>
  );

  const renderMutualFriend = ({ item }: any) => (
    <View style={styles.mutualFriendCard}>
      <Text style={styles.mutualAvatar}>{item.avatar}</Text>
      <Text style={styles.mutualName} numberOfLines={2}>{item.name}</Text>
    </View>
  );

  const renderGroupMember = ({ item }: any) => (
    <View style={styles.groupMemberCard}>
      <Text style={styles.groupMemberAvatar}>{item.avatar}</Text>
      <Text style={styles.groupMemberName}>{item.name}</Text>
    </View>
  );

  const friendsSections = [
    ...(friendRequests.length > 0 ? [{
      title: `Richieste pendenti (${friendRequests.length})`,
      data: friendRequests,
      type: "requests" as const,
    }] : []),
    {
      title: `Online (${onlineFriends.length})`,
      data: onlineFriends,
      type: "friends" as const,
      isOnline: true,
    },
    ...(offlineFriends.length > 0 ? [{
      title: `Offline (${offlineFriends.length})`,
      data: offlineFriends,
      type: "friends" as const,
      isOnline: false,
    }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Amici</Text>
          <Text style={styles.subtitle}>Condividi i momenti</Text>
        </View>
        <TouchableOpacity 
          style={[styles.addButton, { shadowColor: theme.colors.primary }]}
          onPress={() => setShowSearchModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="user-plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Stats cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Feather name="users" size={24} color={theme.colors.primary} />
          <Text style={styles.statValue}>{friends.length}</Text>
          <Text style={styles.statLabel}>Amici</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="activity" size={24} color={theme.colors.accent} />
          <Text style={styles.statValue}>{onlineFriends.length}</Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === "friends" && styles.tabActive]}
          onPress={() => setActiveTab("friends")}
        >
          <Text style={[styles.tabText, activeTab === "friends" && styles.tabTextActive]}>Amici</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === "groups" && styles.tabActive]}
          onPress={() => setActiveTab("groups")}
        >
          <Text style={[styles.tabText, activeTab === "groups" && styles.tabTextActive]}>Gruppi ({groups.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === "friends" ? (
        loadingFriends || loadingRequests ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Caricamento amici</Text>
            <Text style={styles.emptyText}>Sto aggiornando la tua lista</Text>
          </View>
        ) : friendsSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>Nessun amico ancora</Text>
            <Text style={styles.emptyText}>Cerca un amico per iniziare</Text>
          </View>
        ) : (
          <SectionList
            sections={friendsSections as any}
            keyExtractor={(item, index) => item.id.toString() + index}
            renderItem={({ item, section }) => renderFriendCard({ item, section })}
            renderSectionHeader={renderSectionHeader}
            scrollEnabled={true}
            style={styles.friendsList}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomActionOffset + 80 }]}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        <View style={styles.groupsContainer}>
          {loadingGroups ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.emptyTitle}>Caricamento gruppi</Text>
              <Text style={styles.emptyText}>Un attimo e ci siamo</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>Crea il tuo primo gruppo</Text>
              <Text style={styles.emptyText}>Invita amici e organizza serate</Text>
            </View>
          ) : (
            <FlatList
              data={groups}
              renderItem={renderGroupCard}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={[styles.groupsList, { paddingBottom: bottomActionOffset + 24 }]}
              style={styles.groupsListContainer}
              scrollEnabled={true}
            />
          )}
          <TouchableOpacity 
            style={[styles.createGroupButtonFloating, { bottom: bottomActionOffset }]}
            onPress={() => setShowCreateGroupModal(true)}
          >
            <Feather name="plus" size={24} color="white" />
            <Text style={styles.createGroupButtonText}>Nuovo Gruppo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Modal */}
      <Modal
        visible={showSearchModal && !selectedProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cerca amici</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <Feather name="search" size={20} color={theme.colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cerca per nome..."
                placeholderTextColor={theme.colors.muted}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Feather name="x" size={20} color={theme.colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {loadingSearch ? (
              <View style={styles.noResultsContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.noResultsText}>Ricerca in corso...</Text>
              </View>
            ) : searchedUsers.length > 0 ? (
              <View style={styles.resultsContainer}>
                <FlatList
                  data={searchedUsers}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={true}
                  contentContainerStyle={styles.searchList}
                />
              </View>
            ) : searchText.length > 0 ? (
              <View style={styles.noResultsContainer}>
                <Feather name="search" size={48} color={theme.colors.border} />
                <Text style={styles.noResultsText}>Nessun risultato</Text>
              </View>
            ) : (
              <View style={styles.suggestedContainer}>
                <Text style={styles.suggestedTitle}>Persone consigliate</Text>
                <FlatList
                  data={usersToAdd}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  contentContainerStyle={styles.searchList}
                />
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Profile Modal */}
      <Modal
        visible={!!selectedProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedProfile(null)}
      >
        <SafeAreaView style={styles.profileModalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={[styles.profileModalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.profileHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setSelectedProfile(null)}
              >
                <Feather name="chevron-left" size={28} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>Profilo</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.profileCard}>
              <Text style={styles.profileAvatar}>{selectedProfile?.avatar}</Text>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{selectedProfile?.name}</Text>
                <View style={styles.mutualBadge}>
                  <Feather name="users" size={14} color={theme.colors.primary} />
                  <Text style={styles.mutualBadgeText}>
                    {getMutualFriends(selectedProfile?.id).length} amici in comune
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.mutualSection}>
              <Text style={styles.mutualSectionTitle}>Amici in comune</Text>
              {getMutualFriends(selectedProfile?.id).length > 0 ? (
                <FlatList
                  data={getMutualFriends(selectedProfile?.id)}
                  renderItem={renderMutualFriend}
                  keyExtractor={(item) => item.id.toString()}
                  numColumns={3}
                  scrollEnabled={false}
                  columnWrapperStyle={styles.mutualGrid}
                  contentContainerStyle={styles.mutualListContent}
                />
              ) : (
                <View style={styles.noMutualContainer}>
                  <Text style={styles.noMutualText}>Nessun amico in comune</Text>
                </View>
              )}
            </View>

            <View style={styles.profileAction}>
              {selectedProfile?.requestId ? (
                <View style={styles.requestInlineActions}>
                  <TouchableOpacity 
                    style={[styles.actionButtonLarge, styles.acceptButton]}
                    onPress={() => handleAcceptFriendRequest(selectedProfile.requestId, selectedProfile.name)}
                  >
                    <Feather name="check" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Accetta</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButtonLarge, styles.rejectButton]}
                    onPress={() => handleRejectFriendRequest(selectedProfile.requestId, selectedProfile.name)}
                  >
                    <Feather name="x" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Rifiuta</Text>
                  </TouchableOpacity>
                </View>
              ) : selectedProfile?.isFriend ? (
                <TouchableOpacity 
                  style={[styles.actionButtonLarge, styles.removeFriendButton]}
                  onPress={() => {
                    Alert.alert(
                      "Rimuovere amico",
                      `Vuoi rimuovere ${selectedProfile?.name}?`,
                      [
                        { text: "Annulla", style: "cancel" },
                        {
                          text: "Rimuovi",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await removeFriend(String(selectedProfile?.id));
                              setFriends((prev) => prev.filter((f) => f.id !== selectedProfile?.id));
                              setSelectedProfile(null);
                            } catch {
                              Alert.alert("Errore", "Impossibile rimuovere l'amico");
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Feather name="user-x" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Rimuovi amico</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.actionButtonLarge, styles.addFriendLargeButton]}
                  onPress={() => handleSendFriendRequest(selectedProfile?.id, selectedProfile?.name)}
                >
                  <Feather name="user-plus" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Aggiungi amico</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={showCreateGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateGroupModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuovo Gruppo</Text>
              <TouchableOpacity onPress={() => setShowCreateGroupModal(false)}>
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.createGroupForm}>
              <Text style={styles.formLabel}>Nome del gruppo</Text>
              <TextInput
                style={styles.groupNameInput}
                placeholder="Es: Crew Universitaria"
                placeholderTextColor={theme.colors.muted}
                value={newGroupName}
                onChangeText={setNewGroupName}
              />

              <Text style={[styles.formLabel, { marginTop: 20 }]}>Seleziona amici</Text>
              <FlatList
                data={friends}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.friendSelectCard,
                      selectedGroupMembers.includes(item.id) && styles.friendSelectCardActive
                    ]}
                    onPress={() => setSelectedGroupMembers(prev =>
                      prev.includes(item.id)
                        ? prev.filter(id => id !== item.id)
                        : [...prev, item.id]
                    )}
                  >
                    <View style={styles.friendSelectContent}>
                      <Text style={styles.avatar}>{item.avatar}</Text>
                      <Text style={styles.friendSelectName}>{item.name}</Text>
                    </View>
                    {selectedGroupMembers.includes(item.id) && (
                      <View style={styles.checkBox}>
                        <Feather name="check" size={16} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={true}
                contentContainerStyle={styles.friendSelectList}
              />

              <TouchableOpacity 
                style={styles.createButton}
                onPress={handleCreateGroup}
              >
                <Feather name="plus" size={20} color="white" />
                <Text style={styles.createButtonText}>Crea Gruppo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Group Detail Modal */}
      <Modal
        visible={!!selectedGroup}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedGroup(null)}
      >
        <SafeAreaView style={styles.profileModalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={[styles.profileModalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.profileHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setSelectedGroup(null)}
              >
                <Feather name="chevron-left" size={28} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>{selectedGroup?.name}</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={[styles.profileCard, { backgroundColor: (selectedGroup?.color || "#6D5BFF") + "15" }]}>
              <View style={[styles.groupIconLarge, { backgroundColor: (selectedGroup?.color || "#6D5BFF") + "30" }]}>
                <Text style={styles.groupIconText}>{selectedGroup?.avatar}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{selectedGroup?.name}</Text>
                <Text style={styles.groupMembersCount}>{selectedGroup?.members.length} membri</Text>
              </View>
            </View>

            <View style={styles.mutualSection}>
              <Text style={styles.mutualSectionTitle}>Membri</Text>
              <FlatList
                data={getGroupMembers(selectedGroup?.id)}
                renderItem={renderGroupMember}
                keyExtractor={(item) => item.id.toString()}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={styles.mutualGrid}
                contentContainerStyle={styles.mutualListContent}
              />
            </View>

            <View style={styles.groupActionsContainer}>
              <TouchableOpacity 
                style={[styles.groupActionButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowInviteModal(true)}
              >
                <Feather name="user-plus" size={20} color="white" />
                <Text style={styles.groupActionText}>Invita amici</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.groupActionButton, { backgroundColor: theme.colors.accent }]}
                onPress={() => setShowVenueModal(true)}
              >
                <Feather name="map-pin" size={20} color="white" />
                <Text style={styles.groupActionText}>Proponi tavolo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invita amici</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={friends.filter(f => !selectedGroup?.members.includes(f.id))}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.inviteCard}
                  onPress={() => handleAddMemberToGroup(item.id, item.name)}
                >
                  <View style={styles.friendContent}>
                    <Text style={styles.avatar}>{item.avatar}</Text>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                  </View>
                  <Feather name="plus" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.inviteList}
              scrollEnabled={true}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Venue Proposal Modal */}
      <Modal
        visible={showVenueModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVenueModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Proponi un tavolo</Text>
              <TouchableOpacity onPress={() => setShowVenueModal(false)}>
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Seleziona locale</Text>
            <FlatList
              data={MOCK_VENUES}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.venueCard}
                  onPress={() => {
                    Alert.alert(
                      "Tavolo proposto!",
                      `Proposta inviata per "${item.name}"`,
                      [{ text: "OK", onPress: () => setShowVenueModal(false) }]
                    );
                  }}
                >
                  <View style={styles.venueIconContainer}>
                    <Text style={styles.venueIcon}>{item.avatar}</Text>
                  </View>
                  <View style={styles.venueInfo}>
                    <Text style={styles.venueName}>{item.name}</Text>
                    <Text style={styles.venuePrice}>{item.price}</Text>
                  </View>
                  <Feather name="arrow-right" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.venueList}
              scrollEnabled={false}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: theme.colors.text,
  },

  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
  },

  addButton: {
    backgroundColor: theme.colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  statValue: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 8,
  },

  statLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: "600",
  },

  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },

  friendsList: {
    flex: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },

  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  dotOnline: {
    backgroundColor: theme.colors.accent,
  },

  dotOffline: {
    backgroundColor: theme.colors.muted,
  },

  dotRequest: {
    backgroundColor: theme.colors.primary,
  },

  friendCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  friendCardOffline: {
    opacity: 0.6,
    borderColor: theme.colors.border,
  },

  friendContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  avatarContainer: {
    position: "relative",
  },

  avatar: {
    fontSize: 32,
  },

  onlineBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
    borderWidth: 2,
    borderColor: theme.colors.background,
    position: "absolute",
    bottom: 0,
    right: 0,
  },

  friendInfo: {
    flex: 1,
  },

  friendName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },

  venueText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
  },

  statusText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "500",
  },

  offlineText: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: "500",
  },

  actions: {
    flexDirection: "row",
    gap: 8,
  },

  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  requestCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  requestContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  requestInfo: {
    flex: 1,
  },

  requestName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  requestTime: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: "500",
  },

  requestActions: {
    flexDirection: "row",
    gap: 8,
  },

  actionButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  acceptButton: {
    backgroundColor: theme.colors.accent,
  },

  rejectButton: {
    backgroundColor: theme.colors.error,
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 16,
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: 8,
    textAlign: "center",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flex: 0.9,
    paddingBottom: 40,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    paddingVertical: 12,
    fontWeight: "500",
  },

  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },

  resultsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.muted,
    marginBottom: 12,
    marginTop: 8,
  },

  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  noResultsText: {
    fontSize: 16,
    color: theme.colors.muted,
    marginTop: 16,
  },

  suggestedContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },

  suggestedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 12,
  },

  searchResultCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  searchResultContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  searchResultInfo: {
    flex: 1,
  },

  searchResultName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  mutualCount: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },

  // Profile Modal Styles
  profileModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  profileModalContent: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },

  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    justifyContent: "center",
    alignItems: "center",
  },

  profileHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },

  profileCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 20,
    alignItems: "center",
    gap: 20,
  },

  profileAvatar: {
    fontSize: 80,
  },

  profileInfo: {
    flex: 1,
    gap: 12,
  },

  profileName: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
  },

  mutualBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary + "33",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    alignSelf: "flex-start",
  },

  mutualBadgeText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  mutualSection: {
    flex: 1,
    paddingHorizontal: 20,
  },

  mutualSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 16,
  },

  mutualGrid: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  mutualListContent: {
    paddingBottom: 20,
  },

  mutualFriendCard: {
    flex: 0.31,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  mutualAvatar: {
    fontSize: 40,
    marginBottom: 8,
  },

  mutualName: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
    lineHeight: 16,
  },

  noMutualContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },

  noMutualText: {
    fontSize: 14,
    color: theme.colors.muted,
  },

  profileAction: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  actionButtonLarge: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  addFriendLargeButton: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  alreadyFriendButton: {
    backgroundColor: theme.colors.accent,
    opacity: 0.8,
  },

  actionButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  requestInlineActions: {
    flexDirection: "row",
    gap: 12,
  },

  removeFriendButton: {
    backgroundColor: theme.colors.error,
    shadowColor: theme.colors.error,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 20,
  },

  tab: {
    flex: 1,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    alignItems: "center",
  },

  tabActive: {
    borderBottomColor: theme.colors.primary,
  },

  tabText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  tabTextActive: {
    color: theme.colors.text,
  },

  // Groups Container
  groupsContainer: {
    flex: 1,
  },

  groupsListContainer: {
    flex: 1,
  },

  groupsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20,
  },

  groupCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: "center",
    gap: 12,
  },

  groupIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  groupIcon: {
    fontSize: 28,
  },

  groupInfo: {
    flex: 1,
  },

  groupName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  groupMembers: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },

  createGroupButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  createGroupButtonFloating: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  createGroupButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  // Create Group Form
  createGroupForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  formLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 8,
  },

  groupNameInput: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "500",
  },

  friendSelectList: {
    paddingVertical: 8,
  },

  friendSelectCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  friendSelectCardActive: {
    backgroundColor: theme.colors.primary + "22",
    borderColor: theme.colors.primary,
  },

  friendSelectContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  friendSelectName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  createButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  // Group Detail
  groupIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  groupIconText: {
    fontSize: 48,
  },

  groupMembersCount: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: 4,
  },

  groupMemberCard: {
    flex: 0.31,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  groupMemberAvatar: {
    fontSize: 40,
    marginBottom: 8,
  },

  groupMemberName: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
  },

  groupActionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },

  groupActionButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  groupActionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  // Invite Modal
  inviteList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  inviteCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },

  // Venue Modal
  venueList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  venueCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },

  venueIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + "22",
    justifyContent: "center",
    alignItems: "center",
  },

  venueIcon: {
    fontSize: 32,
  },

  venueInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  venueName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },

  venuePrice: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },

  // Search List
  searchList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
