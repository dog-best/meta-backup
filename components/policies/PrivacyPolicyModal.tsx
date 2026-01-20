import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

// Local policy fallback
import { LOCAL_POLICY, LocalPolicy } from "./localPolicy";

// Feature flag hook to switch between local / remote
import { useFeatureFlag } from "../../hooks/policy/useFeatureFlag";

// Optional remote fetch (used only if feature flag enabled)
import { fetchRemotePolicy, RemotePolicy } from "../../hooks/policy/fetchRemotePolicy";

type Policy = LocalPolicy | RemotePolicy;

export default function PrivacyPolicyModal({
  visible,
  onAccept,
  onReject,
}: {
  visible: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  // Feature flag: should we fetch remote policy?
  const { enabled: useRemote, loading: flagLoading } =
    useFeatureFlag("use_remote_policy");

  const [policy, setPolicy] = useState<Policy>(LOCAL_POLICY);
  const [loading, setLoading] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  // Fetch policy when feature flag says remote
  useEffect(() => {
    if (flagLoading || !useRemote) {
      // fallback: use local
      setPolicy(LOCAL_POLICY);
      return;
    }

    setLoading(true);

    fetchRemotePolicy("privacy_policy")
      .then((remote) => {
        if (remote) setPolicy(remote);
        else setPolicy(LOCAL_POLICY); // hard fallback if fetch fails
      })
      .finally(() => setLoading(false));
  }, [useRemote, flagLoading]);

  // Debug logging
  useEffect(() => {
    console.log("[policy-modal] visible:", visible);
    console.log("[policy-modal] loading:", loading);
    console.log("[policy-modal] has content:", !!policy?.content);
  }, [visible, loading, policy]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen" // 🔥 iOS required
      statusBarTranslucent // 🔥 Android required
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* HEADER */}
          <View style={styles.header}>
            <Image
              source={require("../assets/images/icon.png")} // ✅ Keep your icon
              style={styles.logo}
            />
            <Text style={styles.title}>{policy.title}</Text>
          </View>

          {/* CONTENT */}
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator color="#8B5CF6" />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator
                contentContainerStyle={styles.scrollContent}
                onScroll={({ nativeEvent }) => {
                  const isBottom =
                    nativeEvent.layoutMeasurement.height +
                      nativeEvent.contentOffset.y >=
                    nativeEvent.contentSize.height - 24;
                  if (isBottom) setAtBottom(true);
                }}
                scrollEventThrottle={16}
              >
                <Text style={styles.text}>{policy.content}</Text>
              </ScrollView>
            )}
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <Pressable style={styles.reject} onPress={onReject}>
              <Text style={styles.rejectText}>Decline</Text>
            </Pressable>

            <Pressable
              style={[styles.accept, !atBottom && { opacity: 0.4 }]}
              disabled={!atBottom}
              onPress={onAccept}
            >
              <Text style={styles.acceptText}>Agree & Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    flex: 1,
    width: "100%",
    maxWidth: 420,
    maxHeight: "90%",
    backgroundColor: "#060B1A",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    overflow: "hidden",
  },
  header: {
    padding: 18,
    paddingBottom: 10,
  },
  logo: {
    width: 56,
    height: 56,
    alignSelf: "center",
    marginBottom: 8,
    borderRadius: 14,
  },
  title: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  text: {
    color: "#9FA8C7",
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  reject: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  accept: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
  },
  rejectText: {
    color: "#F87171",
    fontWeight: "800",
    textAlign: "center",
  },
  acceptText: {
    color: "#fff",
    fontWeight: "900",
    textAlign: "center",
  },
});
