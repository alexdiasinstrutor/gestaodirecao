import type { Student, User } from '../types';
export function resolveStudentIdentity(students: Student[], user: User): Student | undefined {
 const email=(user.email || '').trim().toLowerCase();
 const matches=students.filter(student=>student.organizacaoId===user.organizacaoId && (student.id===user.id || (!!user.cpfFingerprint && !!student.cpfFingerprint && student.cpfFingerprint===user.cpfFingerprint) || (!!email && (student.email || '').trim().toLowerCase()===email)));
 return matches.length===1?matches[0]:undefined;
}
