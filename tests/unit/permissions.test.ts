import { describe, expect, it } from "vitest";

import { canAccessModule, hasPermission } from "@/utils/permissions";

describe("canAccessModule", () => {
  it("restricts dashboard to admin", () => {
    expect(canAccessModule("Admin", [], "dashboard")).toBe(true);
    expect(canAccessModule("Manager", [], "dashboard")).toBe(false);
    expect(canAccessModule("Staff", ["stock_in"], "dashboard")).toBe(false);
  });

  it("allows manager analytics access", () => {
    expect(canAccessModule("Manager", [], "analytics")).toBe(true);
    expect(canAccessModule("Staff", ["stock_out"], "analytics")).toBe(false);
  });

  it("allows staff with stock_out to billing and sales", () => {
    expect(canAccessModule("Staff", ["stock_out"], "billing")).toBe(true);
    expect(canAccessModule("Staff", ["stock_out"], "sales")).toBe(true);
    expect(canAccessModule("Staff", ["stock_in"], "billing")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("grants admin and manager all staff permissions", () => {
    expect(hasPermission("Admin", [], "stock_in")).toBe(true);
    expect(hasPermission("Manager", [], "stock_out")).toBe(true);
  });

  it("checks staff permission flags", () => {
    expect(hasPermission("Staff", ["stock_in"], "stock_in")).toBe(true);
    expect(hasPermission("Staff", ["stock_in"], "stock_out")).toBe(false);
  });
});
