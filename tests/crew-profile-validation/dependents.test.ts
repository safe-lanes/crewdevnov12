import { describe, expect, it, vi } from "vitest";
import { saveProfileDependents } from "../../client/src/modules/crew-pool/saveProfileDependents";

function fixture() {
  const data:any={children:[
    {id:"blank",firstName:""},
    {id:"local-child",firstName:"Child",dateOfBirth:"2020-01-01"},
  ]};
  const deleted:string[]=["delete-ok","delete-retry"];
  const ackChild=vi.fn((id:string,uuid:string)=>{
    data.children=data.children.map((c:any)=>c.id===id?{...c,childUuid:uuid}:c);
  });
  const ackDelete=vi.fn((uuid:string)=>{const i=deleted.indexOf(uuid);if(i>=0)deleted.splice(i,1);});
  const api={
    saveNextOfKin:vi.fn(async()=>({})),deleteChild:vi.fn(async(_:string,uuid:string)=>({uuid})),
    createChild:vi.fn(async()=>({childUuid:"saved-child"})),updateChild:vi.fn(async()=>({})),
  };
  const uncertainCreates=new Set<string>();
  const save=()=>saveProfileDependents({crewUuid:"crew",data,deleted:[...deleted],api,uncertainCreates,
    acknowledgeChild:ackChild,acknowledgeDelete:ackDelete});
  return {data,deleted,api,save,ackChild,ackDelete};
}
describe("Family/NOK/child save acknowledgments",()=>{
  it("binds created identity to the stable row, not the filtered row index",async()=>{
    const f=fixture();await f.save();
    expect(f.data.children[0].childUuid).toBeUndefined();
    expect(f.data.children[1].childUuid).toBe("saved-child");
    expect(f.api.createChild.mock.calls[0][1]).toMatchObject({sortOrder:0,dob:"2020-01-01"});
  });
  it("acknowledges only successful deletes and retains created identities on partial failure",async()=>{
    const f=fixture();
    f.api.deleteChild.mockRejectedValueOnce(new Error("offline"));
    await expect(f.save()).rejects.toThrow("deletion");
    expect(f.deleted).toEqual(["delete-ok"]);expect(f.data.children[1].childUuid).toBe("saved-child");
    await f.save();
    expect(f.api.createChild).toHaveBeenCalledOnce();
    expect(f.api.updateChild).toHaveBeenCalledOnce();
    expect(f.deleted).toEqual([]);
  });
  it("reports NOK failure rather than a successful section save",async()=>{
    const f=fixture();f.api.saveNextOfKin.mockRejectedValueOnce(new Error("offline"));
    await expect(f.save()).rejects.toThrow("Next of kin");
    expect(f.ackChild).toHaveBeenCalledOnce();
  });
  it("prevents blind duplicate child creates when the response is lost",async()=>{
    const f=fixture();f.api.createChild.mockRejectedValueOnce(new Error("network lost"));
    await expect(f.save()).rejects.toThrow("network lost");
    await expect(f.save()).rejects.toThrow("Reload");
    expect(f.api.createChild).toHaveBeenCalledOnce();
  });
  it("allows a corrected retry after a confirmed rejected creation",async()=>{
    const f=fixture();f.api.createChild.mockRejectedValueOnce(new Error("400: Invalid data"));
    await expect(f.save()).rejects.toThrow("Invalid data");
    await f.save();expect(f.api.createChild).toHaveBeenCalledTimes(2);
  });
  it("requires an identity acknowledgment rather than claiming success",async()=>{
    const f=fixture();f.api.createChild.mockResolvedValueOnce({} as any);
    await expect(f.save()).rejects.toThrow("not confirmed");
    await expect(f.save()).rejects.toThrow("Reload");
    expect(f.ackChild).not.toHaveBeenCalled();
  });
  it("preserves existing child optional fields without inventing an age or required-name rule",async()=>{
    const f=fixture();f.data.children=[{id:"optional",firstName:"",dateOfBirth:"2025-01-01"}];
    await f.save();
    expect(f.api.createChild.mock.calls[0][1]).toMatchObject({firstName:"",dob:"2025-01-01"});
  });
});
