import { CrewContentRepository } from "../repositories";
import type { ContentPageKey, UpsertContentPageRequest } from "../../../../../shared/v2/crew-app/types";

const crewContentRepository = new CrewContentRepository();

export const crewContentService = {
  /** Runs inside the tenant context established by crewAuthMiddleware. */
  async getPage(domain: string, pageKey: ContentPageKey) {
    const page = await crewContentRepository.findByDomainAndKey(domain, pageKey);
    if (!page || page.isPublished === false) {
      throw new Error("Content page not found");
    }
    return page;
  },

  async listAllForAdmin(domain: string) {
    return crewContentRepository.listByDomain(domain);
  },

  async upsertPage(
    domain: string,
    pageKey: ContentPageKey,
    data: UpsertContentPageRequest,
    adminCrewUuid: string,
  ) {
    return crewContentRepository.upsert(domain, pageKey, data, adminCrewUuid);
  },
};
