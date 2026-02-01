import { Modal, Pressable, View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard } from "react-native";
import { useState, useEffect } from "react";

export default function PromptModal({ visible, title, placeholder, keyboardType = 'default', onCancel, onSubmit }: any) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            keyboardType={keyboardType}
            style={styles.modalInput}
            placeholderTextColor="rgba(0,0,0,0.45)"
            autoFocus
          />

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => { setValue(''); onCancel(); }} style={[styles.modalBtn, styles.modalCancel]}>
              <Text style={styles.modalBtnText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSubmit(value)} style={[styles.modalBtn, styles.modalConfirm]}>
              <Text style={styles.modalConfirmText}>Conferma</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: "#1a1a1a",
  },

  modalActions: {
    flexDirection: "row",
    gap: 12,
  },

  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  modalCancel: {
    backgroundColor: "#f0f0f0",
  },

  modalBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },

  modalConfirm: {
    backgroundColor: "#6D5BFF",
  },

  modalConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});
