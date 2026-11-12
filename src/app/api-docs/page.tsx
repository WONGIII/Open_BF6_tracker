import type { Metadata } from "next";
import ApiDocsClient from "./ApiDocsClient";

export const metadata: Metadata = {
  title: "Public API Reference — OpenBF6Tracker",
  description:
    "OpenBF6Tracker Public API v1: player search, career profiles, match reports, player details, server browser and service status.",
};

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}
