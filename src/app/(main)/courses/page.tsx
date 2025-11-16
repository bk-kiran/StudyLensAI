import { Metadata } from "next";
import { CoursesPage } from "./courses-page";

export const metadata: Metadata = {
  title: "Your Courses",
};

export default function Page() {
  return <CoursesPage />;
}