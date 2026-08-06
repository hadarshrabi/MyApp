import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import { BusinessDataProvider } from "./context/BusinessDataContext";
import { AttendanceExceptionsProvider } from "./context/AttendanceExceptionsContext";
import "./styles.css";

document.documentElement.lang = "he";
document.documentElement.dir = "rtl";

createRoot(document.getElementById("root")!).render(<StrictMode><AuthProvider><BusinessDataProvider><AppProvider><AttendanceExceptionsProvider><App /></AttendanceExceptionsProvider></AppProvider></BusinessDataProvider></AuthProvider></StrictMode>);
