export interface PersonalCourse {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersonalChapter {
  readonly id: string;
  readonly ownerId: string;
  readonly courseId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersonalNotion {
  readonly id: string;
  readonly ownerId: string;
  readonly courseId: string;
  readonly chapterId: string | null;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersonalTaxonomyRepository {
  listCourses(ownerId: string): Promise<readonly PersonalCourse[]>;
  listChapters(
    ownerId: string,
    courseId?: string,
  ): Promise<readonly PersonalChapter[]>;
  listNotions(
    ownerId: string,
    courseId?: string,
  ): Promise<readonly PersonalNotion[]>;
  saveCourse(course: PersonalCourse, ownerId: string): Promise<void>;
  saveChapter(chapter: PersonalChapter, ownerId: string): Promise<void>;
  saveNotion(notion: PersonalNotion, ownerId: string): Promise<void>;
}

export function assertPersonalTaxonomyOwner(
  value: { readonly ownerId: string },
  ownerId: string,
): void {
  if (!ownerId || value.ownerId !== ownerId)
    throw new Error('Compte incohérent.');
}
