import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Song } from '../music/types';
import { allSongs, deleteSong, importSong, isDemo } from '../store/songs';
import { ink, mono, serif } from '../theme';

export default function Library() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    allSongs().then(setSongs, e => Alert.alert('Could not load your songs', String(e.message ?? e)));
  }, []);
  useFocusEffect(refresh);

  const add = async () => {
    setBusy(true);
    try {
      const song = await importSong();
      if (song) router.push(`/song/${song.id}`);
      refresh();
    } catch (e) {
      Alert.alert('That file did not work', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (song: Song) =>
    Alert.alert(`Remove ${song.title}?`, 'Your scores for it go too.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => (deleteSong(song.id), refresh()) },
    ]);

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={songs}
        keyExtractor={s => s.id}
        ListHeaderComponent={<Text style={styles.title}>Setlist</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(`/song/${item.id}`)}
            onLongPress={isDemo(item.id) ? undefined : () => remove(item)}
          >
            <Text style={styles.song}>{item.title}</Text>
            {item.credit && <Text style={styles.credit}>{item.credit}</Text>}
            <Text style={styles.parts}>{item.parts.map(p => p.name).join('  ·  ')}</Text>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Pressable style={[styles.add, busy && styles.pressed]} onPress={add} disabled={busy}>
          <Text style={styles.addLabel}>{busy ? 'Reading the score…' : 'Add a score'}</Text>
        </Pressable>
        <Text style={styles.hint}>MusicXML (.musicxml, .mxl or .xml). From a PDF, open it in MuseScore first and export MusicXML.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.stage },
  title: { color: ink.paper, fontFamily: serif, fontSize: 40, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  row: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink.rule, gap: 3 },
  pressed: { opacity: 0.6 },
  song: { color: ink.paper, fontFamily: serif, fontSize: 22 },
  credit: { color: ink.dim, fontSize: 14 },
  parts: { color: ink.bloom, fontFamily: mono, fontSize: 11, marginTop: 6, letterSpacing: 0.5 },
  footer: { padding: 20, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink.rule },
  add: { backgroundColor: ink.paper, paddingVertical: 15, alignItems: 'center' },
  addLabel: { color: ink.stage, fontSize: 16, fontWeight: '600' },
  hint: { color: ink.dim, fontSize: 13, lineHeight: 18 },
});
