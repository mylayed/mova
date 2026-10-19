import { StyleSheet, View } from 'react-native';

import { Body, Card, Screen, Title } from '@/components/ui';
import { LANGUAGES } from '@/config/languages';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  return (
    <Screen>
      <Title>{t('profile.title')}</Title>

      <Card>
        <Body muted>{t('profile.myLanguages')}</Body>
        {LANGUAGES.slice(0, 6).map((lang) => (
          <View key={lang.code} style={styles.row}>
            <Body>
              {lang.code.toUpperCase()} · {lang.nameUk}
            </Body>
            {!lang.enabled && <Body muted style={styles.small}>{t('common.soon')}</Body>}
          </View>
        ))}
      </Card>

      <Card>
        <Row label={t('profile.uiLanguage')} value="Українська" />
        <Row label={t('profile.plan')} value="Free" />
      </Card>

      <Card>
        <Body>{t('profile.signOut')}</Body>
        <Body style={{ color: colors.mistake }}>{t('profile.deleteAccount')}</Body>
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Body>{label}</Body>
      <Body muted>{value}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36, gap: spacing.sm },
  small: { fontSize: 13 },
});
