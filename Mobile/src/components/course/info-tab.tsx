import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { BarChart3, BookOpen, Clock, Library, Scale, User, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Card, Eyebrow, IconSquare, T } from '@/components/web';
import { C } from '@/constants/theme';
import type { CourseInfo } from '@/lib/types';

const DAYS = [{ key: 'MON' }, { key: 'TUE' }, { key: 'WED' }, { key: 'THU' }, { key: 'FRI' }];
const WORDS: Record<string, string> = { mon: 'MON', tue: 'TUE', wed: 'WED', thu: 'THU', fri: 'FRI' };

/** Best-effort: weekdays + time range from free-text meeting_times ("Tuesday 9:25 AM - 10:50 AM",
 *  "MWF 10:00-10:50", "TR 2:00-3:15 PM", "TTh 9:25"). Exported for tests. */
export function parseSchedule(text?: string) {
  if (!text) return null;
  const time = text.match(/(\d{1,2}(:\d{2})?\s*([ap]\.?m\.?)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*([ap]\.?m\.?)?)/i)?.[1]?.replace(/\s+/g, ' ');
  const found = new Set<string>();
  for (const m of text.toLowerCase().matchAll(/\b(mon|tue|wed|thu|fri)[a-z]*\.?/g)) found.add(WORDS[m[1]]);
  if (!found.size) {
    // Compact codes are uppercase letter runs like MWF / TR / TTh / MW.
    const code = text.match(/\b((?:Th|Tu|[MTWRF])+)\b/)?.[1];
    if (code) {
      for (const tok of code.match(/Th|Tu|[MTWRF]/g) ?? []) {
        found.add({ M: 'MON', T: 'TUE', Tu: 'TUE', W: 'WED', R: 'THU', Th: 'THU', F: 'FRI' }[tok]!);
      }
    }
  }
  const days = DAYS.map((d) => d.key).filter((k) => found.has(k));
  return days.length ? { days, time } : null;
}

function Section({ icon, bg, fg, title, children }: { icon: LucideIcon; bg: string; fg: string; title: string; children: ReactNode }) {
  return (
    <Card radius={24} padding={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <IconSquare icon={icon} bg={bg} fg={fg} />
        <T size={16} weight="semibold" color={C.slate900}>{title}</T>
      </View>
      <View style={{ gap: 14 }}>{children}</View>
    </Card>
  );
}

function Field({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <T size={12} color={C.slate400}>{label}</T>
      {link ? (
        <Pressable onPress={() => (link.startsWith('mailto:') || link.startsWith('tel:') ? Linking.openURL(link) : WebBrowser.openBrowserAsync(link))}>
          <T size={14} color={C.brand}>{value}</T>
        </Pressable>
      ) : (
        <T size={14} color={C.slate800}>{value}</T>
      )}
    </View>
  );
}

const list = (v?: string[] | string) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

export function InfoTab({ info, courseName }: { info: CourseInfo | null; courseName: string }) {
  if (!info) {
    return (
      <Card radius={24} padding={24} style={{ alignItems: 'center' }}>
        <IconSquare icon={BookOpen} bg="#EEF2FF" fg={C.brand} size={48} radius={24} />
        <T size={16} weight="semibold" color={C.slate900} style={{ marginTop: 12 }}>No course info yet</T>
        <T size={14} color={C.slate500} style={{ textAlign: 'center', marginTop: 4 }}>Upload the syllabus and ClassMate fills in the instructor, schedule, grading, and policies.</T>
      </Card>
    );
  }
  const { instructor: ins, logistics: lg, policies: pol, materials: mat } = info;
  const grades = (info.grade_breakdown ?? []).filter((g) => g.component && g.weight);
  const schedule = parseSchedule(lg?.meeting_times);

  return (
    <View style={{ gap: 16 }}>
      {schedule ? (
        <Card radius={24} padding={20}>
          <T size={18} weight="semibold" color={C.slate900}>Class Schedule</T>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
            {DAYS.map(({ key }) => {
              const on = schedule.days.includes(key);
              return (
                <View key={key} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                  <Eyebrow color={C.slate400} tracking={1.2} style={{ fontSize: 11 }}>{key}</Eyebrow>
                  {on ? (
                    <LinearGradient colors={[C.brand, C.brandEnd]} style={{ width: '100%', minHeight: 72, borderRadius: 12, padding: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <T size={10} weight="semibold" color="#fff" numberOfLines={2} style={{ textAlign: 'center', lineHeight: 13 }}>{courseName}</T>
                      {schedule.time ? <T size={9} color="rgba(255,255,255,0.85)" style={{ textAlign: 'center', marginTop: 2, lineHeight: 12 }}>{schedule.time}</T> : null}
                    </LinearGradient>
                  ) : (
                    <View style={{ width: '100%', minHeight: 72, borderRadius: 12, borderWidth: 1, borderColor: C.slate100, backgroundColor: C.slate50, alignItems: 'center', justifyContent: 'center' }}>
                      <T color={C.slate300}>—</T>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {ins && (ins.name || ins.email) ? (
        <Section icon={User} bg="#EEF2FF" fg={C.brand} title="Instructor">
          <Field label="Name" value={ins.name} />
          <Field label="Email" value={ins.email} link={ins.email ? `mailto:${ins.email}` : undefined} />
          <Field label="Office" value={ins.office} />
          <Field label="Office Hours" value={ins.office_hours} />
          <Field label="Phone" value={ins.phone} link={ins.phone ? `tel:${ins.phone.replace(/[^\d+]/g, '')}` : undefined} />
        </Section>
      ) : null}

      {lg && Object.values(lg).some(Boolean) ? (
        <Section icon={Clock} bg="#F0FDFF" fg="#38BDF8" title="Course Logistics">
          <Field label="Meeting" value={lg.meeting_times} />
          <Field label="Location" value={lg.location} />
          <Field label="Attendance" value={lg.attendance_policy} />
          <Field label="Late Work" value={lg.late_work_policy} />
        </Section>
      ) : null}

      <Section icon={BarChart3} bg="#F3E8FF" fg={C.lavender} title="Grade Breakdown">
        {grades.length ? (
          grades.map((g, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <T size={14} color={C.slate700} style={{ flex: 1 }}>{g.component}</T>
              <T size={14} weight="semibold" color={C.slate900} style={{ flex: 1, textAlign: 'right' }}>{g.weight}</T>
            </View>
          ))
        ) : (
          <T size={14} color={C.slate400} style={{ fontStyle: 'italic' }}>No grade breakdown available</T>
        )}
      </Section>

      {pol && Object.values(pol).some(Boolean) ? (
        <Section icon={Scale} bg="#FFF7ED" fg={C.orange} title="Policies">
          <Field label="Participation" value={pol.participation} />
          <Field label="Academic Integrity" value={pol.academic_integrity} />
          <Field label="Extra Credit" value={pol.extra_credit} />
          <Field label="Prerequisites" value={pol.prerequisites} />
        </Section>
      ) : null}

      {mat && Object.values(mat).some((v) => (Array.isArray(v) ? v.length : v)) ? (
        <Section icon={Library} bg="#ECFDF5" fg="#4ADE80" title="Materials & Resources">
          <View style={{ gap: 4 }}>
            <T size={12} color={C.slate400}>Required Textbooks</T>
            {list(mat.required_textbooks).length ? list(mat.required_textbooks).map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <BookOpen size={14} color={C.slate400} style={{ marginTop: 3 }} />
                <T size={14} color={C.slate700} style={{ flex: 1 }}>{b}</T>
              </View>
            )) : <T size={14} color={C.slate400} style={{ fontStyle: 'italic' }}>None listed</T>}
          </View>
          <View style={{ gap: 4 }}>
            <T size={12} color={C.slate400}>Recommended Readings</T>
            {list(mat.recommended_readings).length ? list(mat.recommended_readings).map((b, i) => <T key={i} size={14} color={C.slate700}>{b}</T>) : <T size={14} color={C.slate400} style={{ fontStyle: 'italic' }}>None listed</T>}
          </View>
          <Field label="Course Portal" value={mat.course_portal} link={mat.course_portal?.startsWith('http') ? mat.course_portal : undefined} />
          <Field label="TA" value={mat.ta_info} />
        </Section>
      ) : null}
    </View>
  );
}
