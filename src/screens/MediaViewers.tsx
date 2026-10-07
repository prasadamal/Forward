import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useVideoPlayer, VideoView } from 'expo-video';
import { RootStackParamList } from '../navigation/types';
import { useItem } from '../store/selectors';
import { useImageUri } from '../store/thumbs';
import { useVault } from '../store/vault';
import { deleteQuietly, writeTempFile } from '../ingest/media';
import { shareItemOut } from '../actions/files';
import { space } from '../theme';
import { IconButton, Txt } from '../ui/primitives';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function TopBar({ title, onClose, onShare }: { title: string; onClose: () => void; onShare?: () => void }) {
  return (
    <View style={styles.bar}>
      <IconButton name="close" label="Close" onPress={onClose} color="#FFF" />
      <Txt variant="bodyStrong" color="#FFF" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Txt>
      {onShare ? <IconButton name="share-outline" label="Share" onPress={onShare} color="#FFF" /> : <View style={{ width: 40 }} />}
    </View>
  );
}

/** Full-screen image. The decrypted image only ever exists in memory. */
export function ImageViewerScreen() {
  const nav = useNavigation<Nav>();
  const { itemId } = useRoute<RouteProp<RootStackParamList, 'ImageViewer'>>().params;
  const item = useItem(itemId);
  const uri = useImageUri(itemId, 'original');
  const { width, height } = useWindowDimensions();
  return (
    <SafeAreaView style={styles.dark}>
      <StatusBar style="light" />
      <TopBar title={item?.title ?? ''} onClose={() => nav.goBack()} onShare={item ? () => void shareItemOut(item) : undefined} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.center}
        maximumZoomScale={5}
        minimumZoomScale={1}
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width, height: height * 0.8 }} resizeMode="contain" accessibilityLabel={item?.title} />
        ) : (
          <ActivityIndicator color="#FFF" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Plays a stored video. It is decrypted to a temporary file for the player and
 * deleted when the screen closes (or when the vault locks).
 */
export function VideoPlayerScreen() {
  const nav = useNavigation<Nav>();
  const { itemId } = useRoute<RouteProp<RootStackParamList, 'VideoPlayer'>>().params;
  const item = useItem(itemId);
  const getBlob = useVault(s => s.getBlob);
  const fileName = item?.meta.media?.fileName;
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let tmp: string | null = null;
    getBlob(itemId, 'original')
      .then(blob => {
        if (!blob || !alive) return;
        tmp = writeTempFile(blob.data, fileName ?? `video.${blob.mime.split('/')[1] ?? 'mp4'}`);
        setUri(tmp);
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      deleteQuietly(tmp ?? undefined);
    };
  }, [itemId, getBlob, fileName]);

  return (
    <SafeAreaView style={styles.dark}>
      <StatusBar style="light" />
      <TopBar title={item?.title ?? ''} onClose={() => nav.goBack()} onShare={item ? () => void shareItemOut(item) : undefined} />
      <View style={[styles.center, { flex: 1 }]}>
        {uri ? <Player uri={uri} /> : failed ? <Txt color="#FFF">This video couldn’t be opened.</Txt> : <ActivityIndicator color="#FFF" />}
      </View>
    </SafeAreaView>
  );
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#000' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
});
