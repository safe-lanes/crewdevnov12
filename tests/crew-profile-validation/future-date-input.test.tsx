import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormattedDateInput } from "../../client/src/components/ui/formatted-date-input";

beforeEach(()=>{
  vi.useFakeTimers({toFake:["Date"]});
  vi.setSystemTime(new Date(2026,10,17,23,59));
});
afterEach(()=>vi.useRealTimers());

function Fixture({max,min,restricted=true}:{max?:string;min?:string;restricted?:boolean}) {
  const [value,setValue]=React.useState("2026-11-16");
  const [valid,setValid]=React.useState(false);
  return <>
    <FormattedDateInput value={value} onChange={e=>setValue(e.target.value)}
      disableFutureDates={restricted} max={max} min={min}
      maxDateErrorMessage="Date of Recruitment cannot be a future date."
      onDraftValidityChange={setValid} data-testid="recruitment"/>
    <output data-testid="accepted">{value}</output>
    <button disabled={!value||!valid}>Save</button>
  </>;
}
describe("Opt-in future date restriction",()=>{
  it("rejects manual future values, retains the draft on blur, and blocks stale accepted values",()=>{
    render(<Fixture/>);
    const input=screen.getByTestId("recruitment-manual");
    fireEvent.change(input,{target:{value:"18-Nov-2026"}});
    fireEvent.blur(input);
    expect(input).toHaveValue("18-Nov-2026");
    expect(screen.getByRole("alert")).toHaveTextContent("Date of Recruitment cannot be a future date.");
    expect(screen.getByTestId("accepted")).toHaveTextContent("2026-11-16");
    expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
    fireEvent.change(input,{target:{value:"17-Nov-2026"}});
    fireEvent.blur(input);
    expect(screen.getByTestId("accepted")).toHaveTextContent("2026-11-17");
    expect(screen.getByRole("button",{name:"Save"})).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it.each(["31-Feb-2026","not a date","17-Nov"])("retains invalid text %s with a format error",value=>{
    render(<Fixture/>);
    const input=screen.getByTestId("recruitment-manual");
    fireEvent.change(input,{target:{value}});
    fireEvent.blur(input);
    expect(input).toHaveValue(value);
    expect(screen.getByRole("alert")).toHaveTextContent("Incorrect date/date format");
    expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
  });
  it("rejects future calendar events and permits today, past dates and clearing",()=>{
    render(<Fixture/>);
    const calendar=screen.getByTestId("recruitment");
    expect(calendar).toHaveAttribute("max","2026-11-17");
    fireEvent.change(calendar,{target:{value:"2026-11-18"}});
    expect(screen.getByTestId("accepted")).toHaveTextContent("2026-11-16");
    fireEvent.change(calendar,{target:{value:"2026-11-17"}});
    expect(screen.getByTestId("accepted")).toHaveTextContent("2026-11-17");
    fireEvent.change(screen.getByTestId("recruitment-manual"),{target:{value:"01-Jan-2020"}});
    expect(screen.getByTestId("accepted")).toHaveTextContent("2020-01-01");
    fireEvent.change(screen.getByTestId("recruitment-manual"),{target:{value:""}});
    expect(screen.getByTestId("accepted")).toBeEmptyDOMElement();
    expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
  });
  it("does not relax an earlier max or bypass min",()=>{
    render(<Fixture max="2026-11-10" min="2026-11-01"/>);
    expect(screen.getByTestId("recruitment")).toHaveAttribute("max","2026-11-10");
    for(const value of ["11-Nov-2026","31-Oct-2026"]){
      fireEvent.change(screen.getByTestId("recruitment-manual"),{target:{value}});
      expect(screen.getByTestId("accepted")).toHaveTextContent("2026-11-16");
      expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
    }
  });
  it("uses today instead of a later explicit max",()=>{
    render(<Fixture max="2027-01-01"/>);
    expect(screen.getByTestId("recruitment")).toHaveAttribute("max","2026-11-17");
  });
  it("does not emit the previous accepted date on calendar blur while the draft is invalid",()=>{
    const blur=vi.fn(),change=vi.fn();
    render(<FormattedDateInput value="2026-11-16" onChange={change} onBlur={blur}
      disableFutureDates data-testid="date"/>);
    fireEvent.change(screen.getByTestId("date-manual"),{target:{value:"18-Nov-2026"}});
    fireEvent.blur(screen.getByTestId("date"));
    expect(change).not.toHaveBeenCalled();expect(blur).not.toHaveBeenCalled();
    expect(screen.getByTestId("date-manual")).toHaveValue("18-Nov-2026");
  });
  it("preserves default opt-out behavior for manually entered out-of-range dates",()=>{
    render(<Fixture restricted={false} max="2026-11-17"/>);
    fireEvent.change(screen.getByTestId("recruitment-manual"),{target:{value:"18-Nov-2026"}});
    expect(screen.getByTestId("accepted")).toHaveTextContent("2026-11-18");
  });
  it("preserves Next Availability's minimum message, draft validity and future-date acceptance",()=>{
    const valid=vi.fn(),change=vi.fn();
    function Next(){
      const [value,setValue]=React.useState("");
      return <FormattedDateInput value={value} onChange={e=>{change();setValue(e.target.value);}} min="2026-11-17"
        minDateErrorMessage="Next Availability Date cannot be before today"
        onDraftValidityChange={valid} data-testid="next"/>;
    }
    render(<Next/>);
    const input=screen.getByTestId("next-manual");
    fireEvent.change(input,{target:{value:"16-Nov-2026"}});
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent("Next Availability Date cannot be before today");
    expect(valid).toHaveBeenLastCalledWith(false);
    fireEvent.change(input,{target:{value:"18-Nov-2026"}});
    expect(valid).toHaveBeenLastCalledWith(true);
    expect(change).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("next")).toHaveAttribute("max","9999-12-31");
  });
  it("leaves date-time mode able to accept future dates",()=>{
    const received:string[]=[];
    render(<FormattedDateInput mode="datetime" value="" onChange={e=>received.push(e.target.value)} data-testid="time"/>);
    fireEvent.change(screen.getByTestId("time"),{target:{value:"18-Nov-2026 10:30"}});
    expect(received).toEqual(["2026-11-18T10:30"]);
  });
  it("re-evaluates today on interaction across midnight instead of using the mounted date",()=>{
    render(<Fixture/>);
    act(()=>vi.setSystemTime(new Date(2026,10,18,0,1)));
    fireEvent.change(screen.getByTestId("recruitment-manual"),{target:{value:"18-Nov-2026"}});
    expect(screen.getByTestId("accepted")).toHaveTextContent("2026-11-18");
    expect(screen.getByRole("button",{name:"Save"})).toBeEnabled();
  });
  it("uses local calendar dates near a UTC date boundary",()=>{
    const actual=new Date(2026,10,18,0,1);
    const original=Date.prototype.toISOString;
    // An input must never derive today's date by truncating a UTC ISO value.
    const iso=vi.spyOn(Date.prototype,"toISOString").mockImplementation(function(){
      if(this.getTime()===actual.getTime()) return "2026-11-17T18:31:00.000Z";
      return original.call(this);
    });
    vi.setSystemTime(actual);
    render(<Fixture/>);
    expect(screen.getByTestId("recruitment")).toHaveAttribute("max","2026-11-18");
    iso.mockRestore();
  });
});
