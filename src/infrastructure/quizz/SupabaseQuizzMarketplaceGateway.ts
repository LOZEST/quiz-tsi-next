import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuizzListing } from '@domain/quizz/QuizzListing';
import type {
  QuizzListingPreview,
  QuizzListingSubmission,
  QuizzMarketplaceGateway,
  QuizzRatingSubmission,
  SubscribedQuizzContent,
} from '@domain/quizz/QuizzMarketplaceGateway';
import { questionFromRemoteRow } from '@infrastructure/questions/SupabaseQuestionRemoteGateway';

interface QuizzListingRow {
  id: string;
  quizz_id: string;
  owner_id: string;
  title: string;
  description: string;
  certified: boolean;
  hidden: boolean;
  average_rating: number | null;
  rating_count: number | string;
  published_at: string;
  certified_at: string | null;
  hidden_at: string | null;
}

function mapListing(row: QuizzListingRow): QuizzListing {
  return {
    id: row.id,
    quizzId: row.quizz_id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    certified: row.certified,
    hidden: row.hidden,
    averageRating:
      row.average_rating === null ? null : Number(row.average_rating),
    ratingCount: Number(row.rating_count),
    publishedAt: row.published_at,
    certifiedAt: row.certified_at,
    hiddenAt: row.hidden_at,
  };
}

interface SubscriptionRow {
  listing_id: string;
  quizz_id: string;
  owner_id: string;
  title: string;
  description: string;
  certified: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class SupabaseQuizzMarketplaceGateway implements QuizzMarketplaceGateway {
  constructor(private readonly client: SupabaseClient) {}

  async publishQuizz(submission: QuizzListingSubmission): Promise<void> {
    const { error } = await this.client.rpc('submit_quizz_listing', {
      p_quizz_id: submission.quizzId,
      p_title: submission.title,
      p_description: submission.description,
    });
    if (error) throw new Error('La publication du Quizz a échoué.');
  }

  async listVisibleListings(): Promise<readonly QuizzListing[]> {
    const response = await this.client.rpc('list_visible_quizz_listings');
    if (response.error)
      throw new Error('Les Quizz de la marketplace n’ont pas pu être chargés.');
    const data = response.data as QuizzListingRow[] | null;
    return (data ?? []).map(mapListing);
  }

  async getListingPreview(listingId: string): Promise<QuizzListingPreview> {
    const response = await this.client.rpc('get_quizz_listing_preview', {
      p_listing_id: listingId,
    });
    if (response.error)
      throw new Error('L’aperçu du Quizz n’a pas pu être chargé.');
    return response.data as QuizzListingPreview;
  }

  async subscribeToListing(listingId: string): Promise<void> {
    const { error } = await this.client.rpc('subscribe_to_quizz_listing', {
      p_listing_id: listingId,
    });
    if (error) throw new Error('L’abonnement au Quizz a échoué.');
  }

  async hasSubscribed(listingId: string): Promise<boolean> {
    const response = await this.client.rpc('has_subscribed_to_quizz_listing', {
      p_listing_id: listingId,
    });
    if (response.error)
      throw new Error('Le statut d’abonnement n’a pas pu être vérifié.');
    return Boolean(response.data);
  }

  async rateListing(submission: QuizzRatingSubmission): Promise<void> {
    const { error } = await this.client.rpc('rate_quizz_listing', {
      p_listing_id: submission.listingId,
      p_score: submission.score,
      p_comment: submission.comment,
    });
    if (error) throw new Error('L’envoi de la note a échoué.');
  }

  async listSubscribedQuizzContent(): Promise<
    readonly SubscribedQuizzContent[]
  > {
    const subscriptionsResponse = await this.client.rpc(
      'list_my_quizz_subscriptions',
    );
    if (subscriptionsResponse.error)
      throw new Error('Les abonnements n’ont pas pu être chargés.');
    const subscriptions = (subscriptionsResponse.data ??
      []) as SubscriptionRow[];
    if (subscriptions.length === 0) return [];

    const quizzIds = subscriptions.map((row) => row.quizz_id);
    const questionResponses = await Promise.all(
      quizzIds.map((quizzId) =>
        this.client
          .from('latest_accessible_questions')
          .select('*')
          .eq('classification->>kind', 'personal')
          .eq('classification->>courseId', quizzId),
      ),
    );
    if (questionResponses.some((response) => response.error))
      throw new Error('Le contenu des Quizz abonnés n’a pas pu être chargé.');
    const questionRows = questionResponses.flatMap(
      (response) => (response.data ?? []) as unknown[],
    );

    return subscriptions.map((subscription) => ({
      listingId: subscription.listing_id,
      quizzId: subscription.quizz_id,
      ownerId: subscription.owner_id,
      title: subscription.title,
      description: subscription.description,
      certified: subscription.certified,
      questions: questionRows
        .filter(
          (row) =>
            isRecord(row) &&
            isRecord(row.classification) &&
            row.classification.courseId === subscription.quizz_id,
        )
        .flatMap((row) => {
          try {
            return [questionFromRemoteRow(row)];
          } catch {
            return [];
          }
        }),
    }));
  }

  async adminListListings(): Promise<readonly QuizzListing[]> {
    const response = await this.client.rpc('admin_list_quizz_listings');
    if (response.error)
      throw new Error('La modération marketplace n’a pas pu être chargée.');
    const data = response.data as QuizzListingRow[] | null;
    return (data ?? []).map(mapListing);
  }

  async adminSetCertified(
    listingId: string,
    certified: boolean,
  ): Promise<void> {
    const { error } = await this.client.rpc(
      'admin_set_quizz_listing_certified',
      { p_listing_id: listingId, p_certified: certified },
    );
    if (error) throw new Error('La certification du listing a échoué.');
  }

  async adminSetHidden(listingId: string, hidden: boolean): Promise<void> {
    const { error } = await this.client.rpc('admin_set_quizz_listing_hidden', {
      p_listing_id: listingId,
      p_hidden: hidden,
    });
    if (error)
      throw new Error('Le retrait/rétablissement du listing a échoué.');
  }
}
