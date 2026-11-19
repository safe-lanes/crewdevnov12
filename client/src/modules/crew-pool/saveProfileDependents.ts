/** An HTTP rejection is known not to have created a row; a lost response is ambiguous. */
export function confirmedProfileRejection(error: unknown): boolean {
  return /^(400|401|403|404|409|422):/.test(String((error as any)?.message || ''));
}

export async function saveProfileDependents(options: {
  crewUuid: string; data: any; deleted: string[]; api: {
    saveNextOfKin: (...args: any[]) => Promise<any>;
    deleteChild: (...args: any[]) => Promise<any>;
    createChild: (...args: any[]) => Promise<any>;
    updateChild: (...args: any[]) => Promise<any>;
  };
  acknowledgeChild: (localId: string, uuid: string) => void;
  acknowledgeDelete: (uuid: string) => void;
  uncertainCreates: Set<string>;
}) {
  const { crewUuid, data, api } = options;
  const errors: string[] = [];
  const nok = {
    firstName: data.nokFirstName, middleName: data.nokMiddleName, familyName: data.nokFamilyName,
    relationship: data.nokRelationship, telephone: data.nokTelephone, email: data.nokEmail, address: data.nokAddress,
  };
  // Include an empty NOK on an explicit save to preserve the existing ability to clear it.
  try { await api.saveNextOfKin(crewUuid, nok); }
  catch (error: any) { errors.push(`Next of kin: ${error.message}`); }
  const children = data.children || [];
  const nonBlank = children.filter((c: any) =>
    [c.firstName, c.middleName, c.familyName, c.dateOfBirth, c.gender].some(v => String(v || '').trim()));
  const blankSaved = children.filter((c: any) => c.childUuid && !nonBlank.includes(c)).map((c: any) => c.childUuid);
  for (const uuid of new Set<string>([...options.deleted, ...blankSaved])) {
    try { await api.deleteChild(crewUuid, uuid); options.acknowledgeDelete(uuid); }
    catch (error: any) { errors.push(`Child deletion: ${error.message}`); }
  }
  for (const [index, child] of nonBlank.entries() as IterableIterator<[number, any]>) {
    const key = `${crewUuid}:${child.id}`;
    try {
      const payload = {
        firstName: child.firstName, middleName: child.middleName, familyName: child.familyName,
        dob: child.dateOfBirth, gender: child.gender, sortOrder: index,
      };
      if (child.childUuid) await api.updateChild(crewUuid, child.childUuid, payload);
      else {
        if (options.uncertainCreates.has(key))
          throw new Error('A previous child creation was not confirmed. Reload the crew record before retrying.');
        options.uncertainCreates.add(key);
        let created: any;
        try { created = await api.createChild(crewUuid, payload); }
        catch (error) {
          if (confirmedProfileRejection(error)) options.uncertainCreates.delete(key);
          throw error;
        }
        if (!created?.childUuid) throw new Error('Child creation was not confirmed. Reload the crew record before retrying.');
        options.uncertainCreates.delete(key);
        options.acknowledgeChild(child.id, created.childUuid);
      }
    } catch (error: any) { errors.push(`Child: ${error.message}`); }
  }
  if (errors.length) throw new Error(errors.join(' '));
}
