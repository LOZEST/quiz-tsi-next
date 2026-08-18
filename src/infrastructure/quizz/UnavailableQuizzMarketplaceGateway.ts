import type { QuizzMarketplaceGateway } from '@domain/quizz/QuizzMarketplaceGateway';

export class UnavailableQuizzMarketplaceGateway implements QuizzMarketplaceGateway {
  private unavailable(): Error {
    return new Error('La marketplace de Quizz n’est pas configurée.');
  }
  publishQuizz(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  listVisibleListings(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  getListingPreview(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  subscribeToListing(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  hasSubscribed(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  rateListing(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  listSubscribedQuizzContent(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  adminListListings(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  adminSetCertified(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  adminSetHidden(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
}
