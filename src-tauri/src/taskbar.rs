//! Mantém o widget na frente da barra de tarefas do Windows.
//!
//! A barra de tarefas também é "sempre no topo" e, quando é clicada ou ativada,
//! passa para a frente de todas as outras janelas desse grupo, inclusive do
//! widget. Aqui uma thread confere a cada pouco se alguma barra de tarefas que
//! encosta no widget está acima dele na ordem das janelas e, só nesse caso,
//! traz o widget de volta para a frente. Nada é feito quando o widget está longe
//! da barra de tarefas, para não disputar a frente com outros apps.

use std::thread;
use std::time::Duration;

use tauri::WebviewWindow;
use windows_sys::Win32::Foundation::{HWND, RECT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, FindWindowW, GW_HWNDPREV, GetWindow, GetWindowRect, HWND_TOPMOST, IsWindowVisible,
    SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SetWindowPos,
};

const CHECK_EVERY: Duration = Duration::from_millis(200);

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Barra de tarefas principal e as dos outros monitores.
fn taskbars() -> Vec<HWND> {
    let primary = wide("Shell_TrayWnd");
    let secondary = wide("Shell_SecondaryTrayWnd");
    let mut found = Vec::new();
    unsafe {
        let main = FindWindowW(primary.as_ptr(), std::ptr::null());
        if !main.is_null() {
            found.push(main);
        }
        let mut after: HWND = std::ptr::null_mut();
        loop {
            after = FindWindowExW(std::ptr::null_mut(), after, secondary.as_ptr(), std::ptr::null());
            if after.is_null() {
                break;
            }
            found.push(after);
        }
    }
    found
}

fn rect(hwnd: HWND) -> Option<RECT> {
    let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    (unsafe { GetWindowRect(hwnd, &mut r) } != 0).then_some(r)
}

fn overlaps(a: &RECT, b: &RECT) -> bool {
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/// `true` se `other` está acima de `hwnd` na ordem das janelas.
fn is_above(hwnd: HWND, other: HWND) -> bool {
    let mut current = hwnd;
    loop {
        current = unsafe { GetWindow(current, GW_HWNDPREV) };
        if current.is_null() {
            return false;
        }
        if current == other {
            return true;
        }
    }
}

fn check(hwnd: HWND) {
    if unsafe { IsWindowVisible(hwnd) } == 0 {
        return;
    }
    let Some(widget) = rect(hwnd) else { return };
    let covered = taskbars()
        .into_iter()
        .any(|bar| rect(bar).is_some_and(|r| overlaps(&widget, &r)) && is_above(hwnd, bar));
    if covered {
        unsafe {
            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS,
            );
        }
    }
}

pub fn keep_above(window: &WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else { return };
    // HWND não é Send; a thread guarda só o endereço.
    let raw = hwnd.0 as isize;
    thread::spawn(move || {
        loop {
            check(raw as HWND);
            thread::sleep(CHECK_EVERY);
        }
    });
}
