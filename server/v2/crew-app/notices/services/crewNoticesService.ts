import { CrewNoticesRepository } from "../repositories";
import { CrewCredentialsRepository } from "../../auth/repositories";
import { CrewNotificationsRepository } from "../../notifications/repositories";
import { paginate, type PageParams } from "../../pagination";
import { notFound } from "../../errors";
import type { CreateNoticeRequest, UpdateNoticeRequest } from "../../../../../shared/v2/crew-app/types";

const crewNoticesRepository = new CrewNoticesRepository();
const crewCredentialsRepository = new CrewCredentialsRepository();
const crewNotificationsRepository = new CrewNotificationsRepository();

async function fanOutNoticePublished(domain: string, noticeUuid: string, title: string) {
  const activeCredentials = await crewCredentialsRepository.listActiveByDomain(domain);
  await crewNotificationsRepository.insertManyIfNotExists(
    activeCredentials.map((c) => ({
      domain,
      crewUuid: c.crewUuid,
      notificationType: "notice",
      title,
      body: null,
      sourceRefUuid: noticeUuid,
      dedupeKey: `notice-${noticeUuid}-${c.crewUuid}`,
    })),
  );
}

export const crewNoticesService = {
  async listPublished(domain: string, page: PageParams) {
    return paginate(page, (limit, offset) => crewNoticesRepository.listPublishedByDomain(domain, limit, offset));
  },

  async listAllForAdmin(domain: string, page: PageParams) {
    return paginate(page, (limit, offset) => crewNoticesRepository.listAllByDomain(domain, limit, offset));
  },

  /**
   * `isAdmin` gates draft visibility, not existence/domain scoping (those
   * are enforced by findByUuid regardless) — a non-admin fetching a draft's
   * UUID directly (e.g. a stale link) gets the same "not found" as a truly
   * nonexistent notice, matching listPublished's filter for everyone else.
   */
  async getByUuid(noticeUuid: string, domain: string, isAdmin: boolean) {
    const notice = await crewNoticesRepository.findByUuid(noticeUuid, domain);
    if (!notice || notice.isDeleted || (!isAdmin && !notice.isPublished)) {
      throw notFound("Notice not found");
    }
    return notice;
  },

  async create(domain: string, data: CreateNoticeRequest, adminCrewUuid: string) {
    const notice = await crewNoticesRepository.create(domain, data, adminCrewUuid);
    if (notice.isPublished) {
      await fanOutNoticePublished(domain, notice.noticeUuid, notice.title);
    }
    return notice;
  },

  async update(noticeUuid: string, domain: string, data: UpdateNoticeRequest, adminCrewUuid: string) {
    const result = await crewNoticesRepository.update(noticeUuid, domain, data, adminCrewUuid);
    if (!result) {
      throw notFound("Notice not found");
    }
    if (result.justPublished) {
      await fanOutNoticePublished(domain, result.notice.noticeUuid, result.notice.title);
    }
    return result.notice;
  },

  async remove(noticeUuid: string, domain: string, adminCrewUuid: string) {
    await crewNoticesRepository.softDelete(noticeUuid, domain, adminCrewUuid);
  },
};
